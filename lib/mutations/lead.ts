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
