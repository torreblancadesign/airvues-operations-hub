// Server Actions for Loop (screen recording) mutations.
"use server";

import { revalidateTag } from "next/cache";
import { randomBytes } from "crypto";
import { del } from "@vercel/blob";
import { createRecords, patchRecords, getRecord } from "../airtable";
import { AuthzError, requireRole } from "../authz";
import { getAppSession } from "../session";
import { resolvePersonByEmail } from "../people";
import { RECORDINGS_TABLE } from "../loops";
import type { LoopCreateInput, LoopLinkKind } from "../loops-types";

export type LoopMutationResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    // Engineers + leads + admins + contractors-as-editor can record.
    await requireRole("admin", "lead", "editor", "engineer");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidate(loopId?: string) {
  revalidateTag("airtable");
  revalidateTag("loops");
  if (loopId) revalidateTag(`loops:id:${loopId}`);
}

function newShareToken(): string {
  return randomBytes(24).toString("base64url"); // 32 chars
}

function linkFieldFor(kind: LoopLinkKind): string | null {
  switch (kind) {
    case "client":
      return "Linked Client";
    case "quote":
      return "Linked Quote";
    case "story":
      return "Linked Story";
    case "lead":
      return "Linked Lead";
    default:
      return null;
  }
}

const TITLE_MAX = 200;

export async function createLoop(
  input: LoopCreateInput,
): Promise<LoopMutationResult<{ id: string; shareToken: string }>> {
  const g = await gate();
  if (g) return g;

  const title = (input.title ?? "").trim().slice(0, TITLE_MAX) || "Untitled recording";
  if (!input.videoUrl || !/^https?:\/\//.test(input.videoUrl)) {
    return { error: "Invalid video URL" };
  }
  if (!Number.isFinite(input.durationSec) || input.durationSec < 0) {
    return { error: "Invalid duration" };
  }

  // Resolve owner from session → People recId.
  let ownerId: string | null = null;
  try {
    const session = await getAppSession();
    const person = await resolvePersonByEmail(session?.user?.email);
    ownerId = person?.id ?? null;
  } catch {
    ownerId = null;
  }

  const shareToken = newShareToken();
  const fields: Record<string, unknown> = {
    Title: title,
    "Video URL": input.videoUrl,
    "Duration (s)": Math.round(input.durationSec),
    "Size (MB)": Math.round(input.sizeMb * 10) / 10,
    "Share Token": shareToken,
    "View Count": 0,
    Deleted: false,
  };
  if (input.posterUrl) fields["Poster URL"] = input.posterUrl;
  if (ownerId) fields.Owner = [ownerId];

  const linkField = linkFieldFor(input.linkKind);
  if (linkField && input.linkedId) {
    fields[linkField] = [input.linkedId];
  }

  try {
    const [created] = await createRecords(RECORDINGS_TABLE, [{ fields }]);
    invalidate(created.id);
    return { ok: true, id: created.id, shareToken };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteLoop(id: string): Promise<LoopMutationResult> {
  const g = await gate();
  if (g) return g;
  try {
    // Read first so we can purge the Blob assets.
    const rec = await getRecord<{
      "Video URL"?: string;
      "Poster URL"?: string;
    }>(RECORDINGS_TABLE, id);
    const urls = [rec.fields["Video URL"], rec.fields["Poster URL"]].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    // Soft-delete the row first (cheap, definitive).
    await patchRecords(RECORDINGS_TABLE, [{ id, fields: { Deleted: true } }]);
    // Best-effort Blob purge; don't fail the action if Blob is unreachable.
    if (process.env.BLOB_READ_WRITE_TOKEN && urls.length > 0) {
      try {
        await del(urls);
      } catch (err) {
        console.warn("[loops] blob purge failed", (err as Error).message);
      }
    }
    invalidate(id);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Public view-count increment (called from /r/[token] page). No role gate.
export async function incrementLoopViewCount(id: string, current: number): Promise<void> {
  try {
    await patchRecords(RECORDINGS_TABLE, [
      { id, fields: { "View Count": current + 1 } },
    ]);
    revalidateTag(`loops:id:${id}`);
  } catch {
    // swallow — view counting is best-effort
  }
}
