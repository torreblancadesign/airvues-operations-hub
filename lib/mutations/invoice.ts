// Server Actions for Invoice mutations.
// createInvoice — inserts an Airtable Invoice row with status="unsent".
// markInvoiceSent — flips status to "sent" so Airtable's automation fires.
"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";

export type CreateInvoiceResult = { ok: true; id: string } | { error: string };
export type MutationResult = { ok: true } | { error: string };

const CreateInvoiceSchema = z.object({
  payerId: z.string().min(1, "Payer is required"),
  quoteId: z.string().min(1).nullable().optional(),
  amount: z.number().positive("Amount must be greater than 0").max(10_000_000),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  type: z.enum(["One-time", "Recurring", "Payment Plan"]),
  source: z.enum(["Stripe", "Fiverr", "Other"]),
  description: z.string().trim().max(1000).optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

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

  const parsed = CreateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;

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
