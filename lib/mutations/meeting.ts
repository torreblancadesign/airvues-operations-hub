// Server Actions for Meeting (recorder + AI notes) mutations.
"use server";

import { revalidateTag } from "next/cache";
import { del } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { createRecords, patchRecords, getRecord } from "../airtable";
import { AuthzError, requireRole } from "../authz";
import { getAppSession } from "../session";
import { resolvePersonByEmail } from "../people";
import { MEETINGS_TABLE } from "../meetings";
import { analyzeMeeting } from "../transcribe-meeting";
import type { MeetingCreateInput } from "../meetings-types";

export type MeetingMutationResult<T = unknown> =
  | ({ ok: true } & T)
  | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireRole("admin", "lead", "editor", "engineer");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidate(id?: string, leadId?: string | null) {
  revalidateTag("airtable");
  revalidateTag("meetings");
  if (id) revalidateTag(`meetings:id:${id}`);
  if (leadId) revalidateTag(`meetings:lead:${leadId}`);
}

const TITLE_MAX = 200;
const VALID_SOURCES = new Set(["meet", "zoom", "manual", "other"]);

export async function createMeeting(
  input: MeetingCreateInput,
): Promise<MeetingMutationResult<{ id: string }>> {
  const g = await gate();
  if (g) return g;

  const title = (input.title ?? "").trim().slice(0, TITLE_MAX) || "Untitled meeting";
  if (!input.audioUrl || !/^https?:\/\//.test(input.audioUrl)) {
    return { error: "Invalid audio URL" };
  }
  if (!Number.isFinite(input.durationSec) || input.durationSec < 0) {
    return { error: "Invalid duration" };
  }
  if (!VALID_SOURCES.has(input.source)) {
    return { error: "Invalid source" };
  }

  let ownerId: string | null = null;
  try {
    const session = await getAppSession();
    const person = await resolvePersonByEmail(session?.user?.email);
    ownerId = person?.id ?? null;
  } catch {
    ownerId = null;
  }

  const fields: Record<string, unknown> = {
    Title: title,
    "Audio URL": input.audioUrl,
    "Duration (s)": Math.round(input.durationSec),
    "Size (MB)": Math.round(input.sizeMb * 10) / 10,
    Source: input.source,
    Status: "Processing",
    Deleted: false,
  };
  if (ownerId) fields.Owner = [ownerId];
  if (input.linkedLeadId) fields.Lead = [input.linkedLeadId];

  try {
    const [created] = await createRecords(MEETINGS_TABLE, [{ fields }]);
    invalidate(created.id, input.linkedLeadId);
    // Fire-and-forget AI analysis. Best-effort; never blocks the upload.
    waitUntil(analyzeMeetingInBackground(created.id, input.audioUrl, input.linkedLeadId));
    return { ok: true, id: created.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function analyzeMeetingInBackground(
  id: string,
  audioUrl: string,
  leadId: string | null,
): Promise<void> {
  try {
    const a = await analyzeMeeting(audioUrl);
    if (!a.transcript && !a.summary && !a.keyDecisions && !a.actionItems && !a.questions) {
      console.warn(`[meetings] analysis returned empty for ${id}`);
      await patchRecords(MEETINGS_TABLE, [{ id, fields: { Status: "Failed" } }]);
      invalidate(id, leadId);
      return;
    }
    await patchRecords(MEETINGS_TABLE, [
      {
        id,
        fields: {
          Transcript: a.transcript,
          Summary: a.summary,
          "Key Decisions": a.keyDecisions,
          "Action Items": a.actionItems,
          "Follow-up Questions": a.questions,
          Status: "Ready",
        },
      },
    ]);
    invalidate(id, leadId);
  } catch (err) {
    console.warn(`[meetings] analyze failed for ${id}:`, (err as Error).message);
    try {
      await patchRecords(MEETINGS_TABLE, [{ id, fields: { Status: "Failed" } }]);
      invalidate(id, leadId);
    } catch {
      /* swallow */
    }
  }
}

export async function regenerateMeetingAnalysis(id: string): Promise<MeetingMutationResult> {
  const g = await gate();
  if (g) return g;
  try {
    const rec = await getRecord<{ "Audio URL"?: string; Lead?: string[] }>(MEETINGS_TABLE, id);
    const audioUrl = rec.fields["Audio URL"];
    const leadId = rec.fields.Lead?.[0] ?? null;
    if (!audioUrl) return { error: "Meeting has no audio URL." };
    await patchRecords(MEETINGS_TABLE, [{ id, fields: { Status: "Processing" } }]);
    invalidate(id, leadId);
    const a = await analyzeMeeting(audioUrl);
    await patchRecords(MEETINGS_TABLE, [
      {
        id,
        fields: {
          Transcript: a.transcript,
          Summary: a.summary,
          "Key Decisions": a.keyDecisions,
          "Action Items": a.actionItems,
          "Follow-up Questions": a.questions,
          Status: "Ready",
        },
      },
    ]);
    invalidate(id, leadId);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateMeetingLead(
  id: string,
  leadId: string | null,
): Promise<MeetingMutationResult> {
  const g = await gate();
  if (g) return g;
  try {
    // Get existing lead for tag invalidation, then patch.
    const rec = await getRecord<{ Lead?: string[] }>(MEETINGS_TABLE, id);
    const oldLead = rec.fields.Lead?.[0] ?? null;
    await patchRecords(MEETINGS_TABLE, [
      { id, fields: { Lead: leadId ? [leadId] : [] } },
    ]);
    invalidate(id, oldLead);
    invalidate(id, leadId);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateMeetingTitle(
  id: string,
  title: string,
): Promise<MeetingMutationResult> {
  const g = await gate();
  if (g) return g;
  const clean = title.trim().slice(0, TITLE_MAX);
  if (!clean) return { error: "Title is required" };
  try {
    await patchRecords(MEETINGS_TABLE, [{ id, fields: { Title: clean } }]);
    invalidate(id);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteMeeting(id: string): Promise<MeetingMutationResult> {
  const g = await gate();
  if (g) return g;
  try {
    const rec = await getRecord<{ "Audio URL"?: string; Lead?: string[] }>(MEETINGS_TABLE, id);
    const url = rec.fields["Audio URL"];
    const leadId = rec.fields.Lead?.[0] ?? null;
    await patchRecords(MEETINGS_TABLE, [{ id, fields: { Deleted: true } }]);
    if (process.env.BLOB_READ_WRITE_TOKEN && url) {
      try {
        await del(url);
      } catch (err) {
        console.warn("[meetings] blob purge failed", (err as Error).message);
      }
    }
    invalidate(id, leadId);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
