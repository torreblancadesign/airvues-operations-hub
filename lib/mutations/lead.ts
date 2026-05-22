// Server Actions for Lead mutations — Status, Transcript, Attachment uploads.
"use server";

import { revalidateTag } from "next/cache";
import { getRecord, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { requireRole, AuthzError } from "../authz";
import type { LeadStatus, LeadAttachment } from "../leads";

export type MutationResult = { ok: true } | { error: string };

const VALID_STATUS: ReadonlySet<LeadStatus> = new Set([
  "New Lead",
  "Needs Review",
  "In Proposal Stage",
  "Sold",
  "Not Sold",
]);

const TRANSCRIPT_MAX = 50_000;

async function gate(): Promise<MutationResult | null> {
  try {
    await requireRole("admin", "lead", "editor");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    throw e;
  }
}

export async function updateLeadStatus(args: {
  leadId: string;
  status: LeadStatus;
}): Promise<MutationResult> {
  const { leadId, status } = args;
  if (!leadId) return { error: "Missing leadId" };
  if (!VALID_STATUS.has(status)) return { error: "Invalid status" };

  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(Tables.Leads.id, [
      { id: leadId, fields: { Status: status } },
    ]);
    revalidateTag("airtable");
    revalidateTag("leads:all");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateLeadTranscript(args: {
  leadId: string;
  transcript: string;
}): Promise<MutationResult> {
  const { leadId, transcript } = args;
  if (!leadId) return { error: "Missing leadId" };
  if (typeof transcript !== "string") return { error: "Invalid transcript" };
  if (transcript.length > TRANSCRIPT_MAX) {
    return { error: `Transcript exceeds ${TRANSCRIPT_MAX} characters` };
  }

  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(Tables.Leads.id, [
      {
        id: leadId,
        fields: { "Paste Meeting Transcript": transcript.length > 0 ? transcript : null },
      },
    ]);
    revalidateTag("airtable");
    revalidateTag("leads:all");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Append uploaded files (URLs hosted on Vercel Blob) to the lead's attachment field.
// Airtable fetches the file from the URL and mirrors it into its own storage,
// returning a rehydrated attachment object (id, size, type, thumbnails).
export type AttachLeadFilesResult =
  | { ok: true; attachments: LeadAttachment[] }
  | { error: string };

const ATTACH_FIELD = "Attach Supporting Documentations";
const MAX_FILES_PER_CALL = 10;

export async function attachLeadFiles(args: {
  leadId: string;
  files: { url: string; filename: string }[];
}): Promise<AttachLeadFilesResult> {
  const { leadId, files } = args;
  if (!leadId) return { error: "Missing leadId" };
  if (!Array.isArray(files) || files.length === 0) return { error: "No files provided" };
  if (files.length > MAX_FILES_PER_CALL) return { error: `Too many files (max ${MAX_FILES_PER_CALL})` };

  for (const f of files) {
    if (!f || typeof f.url !== "string" || typeof f.filename !== "string") {
      return { error: "Invalid file entry" };
    }
    // Only allow Vercel Blob URLs — prevents drive-by attachment of arbitrary URLs.
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(f.url)) {
      return { error: "File URL must be a Vercel Blob URL" };
    }
    if (f.filename.length === 0 || f.filename.length > 255) {
      return { error: "Invalid filename" };
    }
  }

  const denied = await gate();
  if (denied) return { error: denied.error };

  try {
    type Existing = Array<{ id: string; url?: string; filename?: string; type?: string; size?: number }>;
    const current = await getRecord<Record<string, Existing | undefined>>(Tables.Leads.id, leadId);
    const existing: Existing = current.fields[ATTACH_FIELD] ?? [];

    const next = [
      ...existing.map((a) => ({ id: a.id })), // preserve existing by id
      ...files.map((f) => ({ url: f.url, filename: f.filename })),
    ];

    const updated = await patchRecords<Record<string, Existing | undefined>>(
      Tables.Leads.id,
      [{ id: leadId, fields: { [ATTACH_FIELD]: next } }],
    );

    revalidateTag("airtable");
    revalidateTag("leads:all");

    const all = updated[0]?.fields[ATTACH_FIELD] ?? [];
    const attachments: LeadAttachment[] = all.map((a) => ({
      id: a.id,
      filename: a.filename ?? "",
      url: a.url ?? "",
      type: a.type ?? null,
      size: typeof a.size === "number" ? a.size : null,
    }));
    return { ok: true, attachments };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
