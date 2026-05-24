// Server Actions for Quote mutations (used by the Pipeline drawer editor).
// All mutations gated by requireRole + revalidate cache tags so the pipeline
// list, the per-quote detail, and downstream pages re-read.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, getRecord, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import { getQuoteDetail } from "../quotes";
import { getStoryById } from "../engineering";
import type { Story } from "../engineering-types";
import type { QuoteAttachment, QuoteDetail, QuoteFieldPatch } from "../quote-types";
import {
  PROJECT_STATUS_CHOICES,
  PROPOSAL_TYPE_CHOICES,
} from "../quote-types";

export type MutationResult<T = void> = ({ ok: true } & T) | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireRole("admin", "lead", "editor");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidateQuote(quoteId: string) {
  revalidateTag("airtable");
  revalidateTag("pipeline:all-quotes");
  revalidateTag(`quote:${quoteId}:stories`);
}

const TEXT_MAX = 50_000;

function buildQuoteFields(patch: QuoteFieldPatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (patch.projectName !== undefined) fields["Project Name"] = patch.projectName;
  if (patch.preparedById !== undefined) {
    fields["Prepared by"] = patch.preparedById ? [patch.preparedById] : [];
  }
  if (patch.preparedDate !== undefined) {
    fields["Prepared Date"] = patch.preparedDate || null;
  }
  if (patch.preparedForId !== undefined) {
    fields["Prepared for"] = patch.preparedForId ? [patch.preparedForId] : [];
  }
  if (patch.projectStatus !== undefined) {
    fields["Project Status"] = patch.projectStatus || null;
  }
  if (patch.proposalType !== undefined) {
    fields["Proposal Type"] = patch.proposalType || null;
  }
  if (patch.customProblemStatement !== undefined) {
    fields["Custom Problem Statement and Solution Summary"] = patch.customProblemStatement;
  }
  if (patch.recommendedApproach !== undefined) {
    fields["Recommended Approach"] = patch.recommendedApproach;
  }
  if (patch.recommendedApproachSummary !== undefined) {
    fields["Recommended Approach Summary"] = patch.recommendedApproachSummary;
  }
  if (patch.projectOverview !== undefined) fields["Project Overview"] = patch.projectOverview;
  if (patch.problemStatementSolution !== undefined) {
    fields["Problem Statement & Our Solution"] = patch.problemStatementSolution;
  }
  if (patch.estimateHoursRange !== undefined) fields["Estimate Hours Range"] = patch.estimateHoursRange;
  if (patch.estimateCostRange !== undefined) fields["Estimate Cost Range"] = patch.estimateCostRange;
  return fields;
}

function validatePatch(patch: QuoteFieldPatch): string | null {
  if (
    patch.projectStatus &&
    !(PROJECT_STATUS_CHOICES as readonly string[]).includes(patch.projectStatus)
  ) {
    return "Invalid project status";
  }
  if (
    patch.proposalType &&
    !(PROPOSAL_TYPE_CHOICES as readonly string[]).includes(patch.proposalType)
  ) {
    return "Invalid proposal type";
  }
  for (const k of [
    "customProblemStatement",
    "recommendedApproach",
    "recommendedApproachSummary",
    "projectOverview",
    "problemStatementSolution",
  ] as const) {
    const v = patch[k];
    if (typeof v === "string" && v.length > TEXT_MAX) {
      return `${k} exceeds ${TEXT_MAX} characters`;
    }
  }
  if (patch.preparedDate && !/^\d{4}-\d{2}-\d{2}$/.test(patch.preparedDate)) {
    return "Prepared date must be YYYY-MM-DD";
  }
  return null;
}

// Load the quote (re-reads after mutations so the client can refresh its form).
export async function loadQuoteDetail(quoteId: string): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  const denied = await gate();
  if (denied) return denied;
  try {
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateQuoteFields(
  quoteId: string,
  patch: QuoteFieldPatch,
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };

  const v = validatePatch(patch);
  if (v) return { error: v };

  const denied = await gate();
  if (denied) return denied;

  const fields = buildQuoteFields(patch);
  if (Object.keys(fields).length === 0) {
    // Nothing to change — just return the current detail.
    try {
      const quote = await getQuoteDetail(quoteId);
      return { ok: true, quote };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  try {
    await patchRecords(Tables.Quotes.id, [{ id: quoteId, fields }]);
    invalidateQuote(quoteId);
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Attachments (Documents needed for Proposal) ----------

const DOC_FIELD = "Documents needed for Proposal";
const MAX_FILES_PER_CALL = 10;

export async function attachQuoteDocuments(args: {
  quoteId: string;
  files: { url: string; filename: string }[];
}): Promise<MutationResult<{ attachments: QuoteAttachment[] }>> {
  const { quoteId, files } = args;
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  if (!Array.isArray(files) || files.length === 0) return { error: "No files provided" };
  if (files.length > MAX_FILES_PER_CALL) {
    return { error: `Too many files (max ${MAX_FILES_PER_CALL})` };
  }
  for (const f of files) {
    if (!f || typeof f.url !== "string" || typeof f.filename !== "string") {
      return { error: "Invalid file entry" };
    }
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(f.url)) {
      return { error: "File URL must be a Vercel Blob URL" };
    }
    if (f.filename.length === 0 || f.filename.length > 255) {
      return { error: "Invalid filename" };
    }
  }

  const denied = await gate();
  if (denied) return denied;

  try {
    type Existing = Array<{ id: string; url?: string; filename?: string; type?: string; size?: number }>;
    const current = await getRecord<Record<string, Existing | undefined>>(Tables.Quotes.id, quoteId);
    const existing: Existing = current.fields[DOC_FIELD] ?? [];

    const next = [
      ...existing.map((a) => ({ id: a.id })),
      ...files.map((f) => ({ url: f.url, filename: f.filename })),
    ];

    const updated = await patchRecords<Record<string, Existing | undefined>>(
      Tables.Quotes.id,
      [{ id: quoteId, fields: { [DOC_FIELD]: next } }],
    );

    invalidateQuote(quoteId);

    const all = updated[0]?.fields[DOC_FIELD] ?? [];
    return {
      ok: true,
      attachments: all.map((a) => ({
        id: a.id,
        filename: a.filename ?? "",
        url: a.url ?? "",
        type: a.type ?? null,
        size: typeof a.size === "number" ? a.size : null,
      })),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Create new story linked to this quote ----------

export type CreateQuoteStoryInput = {
  quoteId: string;
  name: string;
  description?: string;
  hours: number;
  cost: number;
  clientNotes?: string;
  status?: string;
};

export async function createQuoteStory(
  input: CreateQuoteStoryInput,
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  const { quoteId } = input;
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  if (!input.name || input.name.trim() === "") return { error: "Story Name is required" };
  if (!isFinite(input.hours) || input.hours <= 0) return { error: "Hours must be positive" };
  if (!isFinite(input.cost) || input.cost < 0) return { error: "Cost must be 0 or greater" };

  const denied = await gate();
  if (denied) return denied;

  // Write to BOTH Cost and Invoice so the Total Cost rollup (whichever field it
  // points at) stays correct alongside any existing per-quote totals.
  const fields: Record<string, unknown> = {
    "Story Name": input.name.trim(),
    Hours: input.hours,
    Cost: input.cost,
    Invoice: input.cost,
    Quote: [quoteId],
    "Story Status": input.status ?? "Todo",
  };
  if (input.description) fields["Description"] = input.description;
  if (input.clientNotes) fields["Client Notes"] = input.clientNotes;

  try {
    await createRecords(Tables.Stories.id, [{ fields }]);
    invalidateQuote(quoteId);
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
