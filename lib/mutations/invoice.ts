// Server Actions for Invoice mutations.
// createInvoice — inserts an Airtable Invoice row with status="unsent".
// updateInvoice — patches editable fields on an existing invoice.
// markInvoiceSent — flips status to "sent" so Airtable's automation fires.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireSignedIn } from "../authz";
import { logEventInternal } from "./project-log";

export type CreateInvoiceResult = { ok: true; id: string } | { error: string };
export type MutationResult = { ok: true } | { error: string };

export type InvoiceType = "One-time" | "Recurring" | "Payment Plan";
export type InvoiceSource = "Stripe" | "Fiverr" | "Other";
export type PaymentPlanFrequency = "weekly" | "biweekly" | "monthly";
export type ClientApproval = "Yes" | "No";
export type FiverrStatus = "Gig Pending Acceptance" | "Gig Accepted" | "Gig Funds Cleared";

export type EditableInvoiceExtras = {
  needsClientApproval?: ClientApproval | null;
  paymentPlanCount?: number | null;
  paymentPlanFrequency?: PaymentPlanFrequency | null;
  discountPercent?: number | null; // 0–1
  discountLength?: number | null;
  fiverrStatus?: FiverrStatus | null;
};

export type CreateInvoiceInput = {
  payerId: string;
  quoteId?: string | null;
  amount: number;
  date: string;
  type: InvoiceType;
  source: InvoiceSource;
  description?: string | null;
} & EditableInvoiceExtras;

export type UpdateInvoiceInput = {
  amount?: number;
  date?: string;
  type?: InvoiceType;
  source?: InvoiceSource;
  description?: string | null;
} & EditableInvoiceExtras;

const TYPES: InvoiceType[] = ["One-time", "Recurring", "Payment Plan"];
const SOURCES: InvoiceSource[] = ["Stripe", "Fiverr", "Other"];
const FREQUENCIES: PaymentPlanFrequency[] = ["weekly", "biweekly", "monthly"];
const APPROVALS: ClientApproval[] = ["Yes", "No"];
const FIVERR_STATUSES: FiverrStatus[] = [
  "Gig Pending Acceptance",
  "Gig Accepted",
  "Gig Funds Cleared",
];

function validateExtras(input: EditableInvoiceExtras): string | null {
  if (input.needsClientApproval != null && !APPROVALS.includes(input.needsClientApproval))
    return "Invalid client-approval value";
  if (input.paymentPlanCount != null) {
    if (!Number.isFinite(input.paymentPlanCount) || input.paymentPlanCount < 1 || input.paymentPlanCount > 120)
      return "Payment plan count must be 1–120";
  }
  if (input.paymentPlanFrequency != null && !FREQUENCIES.includes(input.paymentPlanFrequency))
    return "Invalid payment plan frequency";
  if (input.discountPercent != null) {
    if (!Number.isFinite(input.discountPercent) || input.discountPercent < 0 || input.discountPercent > 1)
      return "Discount must be between 0 and 1";
  }
  if (input.discountLength != null) {
    if (!Number.isFinite(input.discountLength) || input.discountLength < 0 || input.discountLength > 120)
      return "Discount length must be 0–120";
  }
  if (input.fiverrStatus != null && !FIVERR_STATUSES.includes(input.fiverrStatus))
    return "Invalid Fiverr status";
  return null;
}

function validateCreate(input: CreateInvoiceInput): string | null {
  if (!input.payerId || typeof input.payerId !== "string") return "Payer is required";
  if (input.quoteId != null && typeof input.quoteId !== "string") return "Invalid quote id";
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 10_000_000)
    return "Amount must be greater than 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Date must be YYYY-MM-DD";
  if (!TYPES.includes(input.type)) return "Invalid type";
  if (!SOURCES.includes(input.source)) return "Invalid source";
  if (input.description != null && (typeof input.description !== "string" || input.description.length > 1000))
    return "Description too long";
  return validateExtras(input);
}

function validateUpdate(input: UpdateInvoiceInput): string | null {
  if (input.amount != null) {
    if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 10_000_000)
      return "Amount must be greater than 0";
  }
  if (input.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Date must be YYYY-MM-DD";
  if (input.type != null && !TYPES.includes(input.type)) return "Invalid type";
  if (input.source != null && !SOURCES.includes(input.source)) return "Invalid source";
  if (input.description != null && (typeof input.description !== "string" || input.description.length > 1000))
    return "Description too long";
  return validateExtras(input);
}

function mapExtrasToFields(input: EditableInvoiceExtras, fields: Record<string, unknown>) {
  if (input.needsClientApproval !== undefined)
    fields["Need Client Approval for Subscription Payment?"] = input.needsClientApproval;
  if (input.paymentPlanCount !== undefined)
    fields["Payment Plan - Number of Payments"] = input.paymentPlanCount;
  if (input.paymentPlanFrequency !== undefined)
    fields["Payment - Plan - Frequency"] = input.paymentPlanFrequency;
  if (input.discountPercent !== undefined) fields["Discount %"] = input.discountPercent;
  if (input.discountLength !== undefined)
    fields["Discount Length (number of payments)"] = input.discountLength;
  if (input.fiverrStatus !== undefined) fields["Fiverr Status"] = input.fiverrStatus;
}

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("money:all-invoices");
}

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  try {
    await requireSignedIn();
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    throw e;
  }

  const err = validateCreate(input);
  if (err) return { error: err };
  const data = input;

  const fields: Record<string, unknown> = {
    "Invoice Payer": [data.payerId],
    "Invoice Amount": data.amount,
    "Date": data.date,
    "Invoice Type": data.type,
    "Invoice Source": data.source,
    "Invoice Status": "unsent",
  };
  if (data.quoteId) fields["Quotes"] = [data.quoteId];
  if (data.description) fields["Invoice Description"] = data.description;
  mapExtrasToFields(data, fields);

  try {
    const created = await createRecords(Tables.Invoices.id, [{ fields }]);
    invalidate();
    const id = created[0]?.id ?? "";
    await logEventInternal({
      accountId: data.payerId,
      projectId: data.quoteId ?? null,
      eventType: "Invoice created",
      detail: `${data.type} · $${data.amount} · ${data.date}`,
    });
    return { ok: true, id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateInvoice(
  recordId: string,
  patch: UpdateInvoiceInput,
): Promise<MutationResult> {
  try {
    await requireSignedIn();
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    throw e;
  }

  if (!recordId || typeof recordId !== "string") return { error: "Invalid invoice id" };
  const err = validateUpdate(patch);
  if (err) return { error: err };

  const fields: Record<string, unknown> = {};
  if (patch.amount !== undefined) fields["Invoice Amount"] = patch.amount;
  if (patch.date !== undefined) fields["Date"] = patch.date;
  if (patch.type !== undefined) fields["Invoice Type"] = patch.type;
  if (patch.source !== undefined) fields["Invoice Source"] = patch.source;
  if (patch.description !== undefined)
    fields["Invoice Description"] = patch.description ?? "";
  mapExtrasToFields(patch, fields);

  if (Object.keys(fields).length === 0) return { ok: true };

  try {
    await patchRecords(Tables.Invoices.id, [{ id: recordId, fields }]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function markInvoiceSent(recordId: string): Promise<MutationResult> {
  try {
    await requireSignedIn();
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    throw e;
  }

  if (!recordId || typeof recordId !== "string") {
    return { error: "Invalid invoice id" };
  }

  try {
    await patchRecords(Tables.Invoices.id, [
      { id: recordId, fields: { "Invoice Status": "sent" } },
    ]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
