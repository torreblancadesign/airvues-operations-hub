// Server Actions for Quote mutations (used by the Pipeline drawer editor).
// All mutations gated by requireRole + revalidate cache tags so the pipeline
// list, the per-quote detail, and downstream pages re-read.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, getRecord, patchRecords, deleteRecord } from "../airtable";
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
import { logEventInternal } from "./project-log";

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
  revalidateTag("scorecard:sales-quotes");
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
  if (patch.deliveryDueDate !== undefined) {
    fields["Client Delivery Due Date"] = patch.deliveryDueDate || null;
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
  // Estimate Hours Range / Estimate Cost Range are no longer written from the UI.
  // Estimate Cost Range is a rollup field in Airtable (read-only); hours range was removed.
  if (patch.blueprint !== undefined) fields["Blueprint"] = patch.blueprint;
  if (patch.epicOwnerId !== undefined) {
    fields["Epic Owner"] = patch.epicOwnerId ? [patch.epicOwnerId] : [];
  }
  if (patch.changeOrderDetails !== undefined) {
    fields["Change Order Details"] = patch.changeOrderDetails;
  }
  if (patch.changeOrderInputDetails !== undefined) {
    fields["Change Order Input Details"] = patch.changeOrderInputDetails;
  }
  if (patch.changeOrderEstimateCost !== undefined) {
    fields["Change Order Estimate Cost"] = patch.changeOrderEstimateCost;
  }
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
    "changeOrderDetails",
  ] as const) {
    const v = patch[k];
    if (typeof v === "string" && v.length > TEXT_MAX) {
      return `${k} exceeds ${TEXT_MAX} characters`;
    }
  }
  if (patch.preparedDate && !/^\d{4}-\d{2}-\d{2}$/.test(patch.preparedDate)) {
    return "Prepared date must be YYYY-MM-DD";
  }
  if (patch.deliveryDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(patch.deliveryDueDate)) {
    return "Delivery due date must be YYYY-MM-DD";
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

// Load a single Story (for opening the StorySheet from the quote drawer).
export async function loadStoryDetail(
  storyId: string,
): Promise<MutationResult<{ story: Story }>> {
  if (!storyId || !storyId.startsWith("rec")) return { error: "Invalid storyId" };
  const denied = await gate();
  if (denied) return denied;
  try {
    const story = await getStoryById(storyId);
    if (!story) return { error: "Story not found" };
    return { ok: true, story };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Flip the Airtable "Run AI Proposal Agent" checkbox so the automation runs.
export async function triggerAiProposalAgent(
  quoteId: string,
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  const denied = await gate();
  if (denied) return denied;
  try {
    await patchRecords(Tables.Quotes.id, [
      { id: quoteId, fields: { "Run AI Proposal Agent": true } },
    ]);
    invalidateQuote(quoteId);
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Flip the Airtable "Run AI Change Order Agent" checkbox so the automation runs.
export async function triggerAiChangeOrderAgent(
  quoteId: string,
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  const denied = await gate();
  if (denied) return denied;
  try {
    await patchRecords(Tables.Quotes.id, [
      { id: quoteId, fields: { "Run AI Change Order Agent": true } },
    ]);
    invalidateQuote(quoteId);
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
    // Capture previous values for status-change logging.
    const before = patch.projectStatus !== undefined ? await getQuoteDetail(quoteId).catch(() => null) : null;
    await patchRecords(Tables.Quotes.id, [{ id: quoteId, fields }]);
    invalidateQuote(quoteId);
    const quote = await getQuoteDetail(quoteId);

    // Project log: project-status transitions + proposal-type changes.
    const accountId = quote.preparedForId ?? null;
    if (patch.projectStatus !== undefined && before && before.projectStatus !== patch.projectStatus) {
      const ev =
        patch.projectStatus === "Proposal Signed"
          ? "Proposal signed"
          : patch.projectStatus === "Commencement Invoice Paid"
            ? "Payment received"
            : "Project status changed";
      await logEventInternal({
        accountId,
        projectId: quoteId,
        eventType: ev,
        detail: `Project Status: ${before.projectStatus ?? "—"} → ${patch.projectStatus}`,
      });
    }
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
  /** Optional for retainer stories (no cost line). */
  cost?: number;
  clientNotes?: string;
  status?: string;
  isChangeOrder?: boolean;
  /** Optional ISO YYYY-MM-DD; used for retainer monthly grouping. */
  completedDate?: string | null;
};

export async function createQuoteStory(
  input: CreateQuoteStoryInput,
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  const { quoteId } = input;
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  if (!input.name || input.name.trim() === "") return { error: "Story Name is required" };
  if (!isFinite(input.hours) || input.hours <= 0) return { error: "Hours must be positive" };
  if (input.cost !== undefined && (!isFinite(input.cost) || input.cost < 0)) {
    return { error: "Cost must be 0 or greater" };
  }
  if (input.completedDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.completedDate)) {
    return { error: "Completed date must be YYYY-MM-DD" };
  }

  const denied = await gate();
  if (denied) return denied;

  // Write to BOTH Cost and Invoice so the Total Cost rollup (whichever field it
  // points at) stays correct alongside any existing per-quote totals.
  const fields: Record<string, unknown> = {
    "Story Name": input.name.trim(),
    Hours: input.hours,
    Quote: [quoteId],
    "Story Status": input.status ?? "Todo",
  };
  if (input.cost !== undefined) {
    fields["Cost"] = input.cost;
    fields["Invoice"] = input.cost;
  }
  if (input.description) fields["Description"] = input.description;
  if (input.clientNotes) fields["Client Notes"] = input.clientNotes;
  if (input.isChangeOrder) fields["Change Order"] = true;
  if (input.completedDate) fields["Completed Date"] = input.completedDate;

  try {
    // Default Quote Order = max existing order in the same subset + 10, so new rows append.
    try {
      const existing = await getQuoteDetail(quoteId);
      const subset = existing.stories.filter((s) => s.isChangeOrder === !!input.isChangeOrder);
      const maxOrder = subset.reduce((m, s) => (s.order != null && s.order > m ? s.order : m), 0);
      fields["Quote Order"] = maxOrder + 10;
    } catch {
      fields["Quote Order"] = 10;
    }

    const created = await createRecords(Tables.Stories.id, [{ fields }]);
    invalidateQuote(quoteId);
    const quote = await getQuoteDetail(quoteId);
    await logEventInternal({
      accountId: quote.preparedForId ?? null,
      projectId: quoteId,
      eventType: "Story created",
      detail: `${input.name.trim()}${input.isChangeOrder ? " (change order)" : ""} · ${input.hours}h${input.cost !== undefined ? ` · $${input.cost}` : ""}`,
    });
    void created;
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Reorder stories within a quote ----------

export async function reorderQuoteStories(
  quoteId: string,
  updates: { id: string; order: number }[],
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  if (updates.length === 0) {
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  }
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(
      Tables.Stories.id,
      updates.map((u) => ({ id: u.id, fields: { "Quote Order": u.order } })),
    );
    invalidateQuote(quoteId);
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Quote Deal Stage (Status field) ----------

const DEAL_STAGE_CHOICES = [
  "Draft",
  "Sent. Awaiting Approval.",
  "Approved and Signed",
  "Awaiting Payment",
  "Project In Progress",
  "Paid",
  "Cancelled",
  "Rejected",
  "Auditing 🚩",
] as const;

export async function updateQuoteDealStage(
  quoteId: string,
  status: string,
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  if (!(DEAL_STAGE_CHOICES as readonly string[]).includes(status)) {
    return { error: "Invalid deal stage" };
  }
  const denied = await gate();
  if (denied) return denied;
  try {
    await patchRecords(Tables.Quotes.id, [{ id: quoteId, fields: { "Status": status } }]);
    invalidateQuote(quoteId);
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Bulk story operations on a quote ----------

export async function bulkDeleteQuoteStories(
  quoteId: string,
  storyIds: string[],
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  if (storyIds.length === 0) {
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  }
  const denied = await gate();
  if (denied) return denied;
  try {
    // No batch DELETE wrapper — fire sequentially in small concurrency.
    for (const id of storyIds) {
      await deleteRecord(Tables.Stories.id, id);
    }
    invalidateQuote(quoteId);
    revalidateTag("engineering:stories");
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type BulkStoryPatch = {
  assigneeIds?: string[];
  status?: string;
};

export async function bulkUpdateQuoteStoriesFields(
  quoteId: string,
  storyIds: string[],
  patch: BulkStoryPatch,
): Promise<MutationResult<{ quote: QuoteDetail }>> {
  if (!quoteId || !quoteId.startsWith("rec")) return { error: "Invalid quoteId" };
  if (storyIds.length === 0) {
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  }
  const denied = await gate();
  if (denied) return denied;

  const fields: Record<string, unknown> = {};
  if (patch.assigneeIds !== undefined) fields["Assignee"] = patch.assigneeIds;
  if (patch.status !== undefined) fields["Story Status"] = patch.status;
  if (Object.keys(fields).length === 0) {
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  }
  try {
    await patchRecords(
      Tables.Stories.id,
      storyIds.map((id) => ({ id, fields })),
    );
    invalidateQuote(quoteId);
    revalidateTag("engineering:stories");
    const quote = await getQuoteDetail(quoteId);
    return { ok: true, quote };
  } catch (e) {
    return { error: (e as Error).message };
  }
}


// ---------- Create draft quote (in-context proposal flow) ----------

export async function createDraftQuote(args: {
  preparedForId?: string | null;
  projectName?: string;
}): Promise<MutationResult<{ quoteId: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const fields: Record<string, unknown> = {
    "Project Name": args.projectName?.trim() || "Untitled proposal",
    "Status": "Draft",
    "Prepared Date": new Date().toISOString().slice(0, 10),
  };
  if (args.preparedForId) {
    fields["Prepared for"] = [args.preparedForId];
  }

  try {
    const created = await createRecords(Tables.Quotes.id, [{ fields }]);
    const newId = created[0]?.id;
    if (!newId) return { error: "Failed to create quote" };
    revalidateTag("airtable");
    revalidateTag("pipeline:all-quotes");
    await logEventInternal({
      accountId: args.preparedForId ?? null,
      projectId: newId,
      eventType: "Proposal drafted",
      detail: fields["Project Name"] as string,
    });
    return { ok: true, quoteId: newId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
