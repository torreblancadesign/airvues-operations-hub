// Server Actions for Invoice mutations.
// createInvoice — inserts an Airtable Invoice row with status="unsent".
// markInvoiceSent — flips status to "sent" so Airtable's automation fires.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";

export type CreateInvoiceResult = { ok: true; id: string } | { error: string };
export type MutationResult = { ok: true } | { error: string };

export type CreateInvoiceInput = {
  payerId: string;
  quoteId?: string | null;
  amount: number;
  date: string;
  type: "One-time" | "Recurring" | "Payment Plan";
  source: "Stripe" | "Fiverr" | "Other";
  description?: string | null;
};

const TYPES = ["One-time", "Recurring", "Payment Plan"] as const;
const SOURCES = ["Stripe", "Fiverr", "Other"] as const;

function validate(input: CreateInvoiceInput): string | null {
  if (!input.payerId || typeof input.payerId !== "string") return "Payer is required";
  if (input.quoteId != null && typeof input.quoteId !== "string") return "Invalid quote id";
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 10_000_000)
    return "Amount must be greater than 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Date must be YYYY-MM-DD";
  if (!TYPES.includes(input.type)) return "Invalid type";
  if (!SOURCES.includes(input.source)) return "Invalid source";
  if (input.description != null && (typeof input.description !== "string" || input.description.length > 1000))
    return "Description too long";
  return null;
}

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("money:all-invoices");
}

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  try {
    await requireRole("admin", "lead", "editor");
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    throw e;
  }

  const err = validate(input);
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

  try {
    const created = await createRecords(Tables.Invoices.id, [{ fields }]);
    invalidate();
    return { ok: true, id: created[0]?.id ?? "" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function markInvoiceSent(recordId: string): Promise<MutationResult> {
  try {
    await requireRole("admin", "lead", "editor");
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
