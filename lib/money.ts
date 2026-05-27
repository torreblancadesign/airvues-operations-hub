// Money page data layer — bulk-fetches all invoices in one cached read,
// returns enriched row shape ready for client-side filtering/sorting/grouping.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type MoneyInvoice = {
  id: string;
  invoiceId: number | null;
  identifier: string;
  payer: string;
  payerRecordId: string | null;
  payerEmail: string | null;
  source: "Stripe" | "Fiverr" | "Other" | null;
  type: "One-time" | "Recurring" | "Payment Plan" | null;
  status: string | null;
  amount: number;
  marginProfit: number | null;
  date: string | null;
  created: string | null;
  lastModified: string | null;
  description: string | null;
  initial: boolean;
  approved: boolean;
  stripeId: string | null;
  stripeLink: string | null;
  subscriptionLink: string | null;
  quoteRecordIds: string[];
  airtableUrl: string;
  // Extended fields
  needsClientApproval: "Yes" | "No" | null;
  paymentPlanCount: number | null;
  paymentPlanFrequency: "weekly" | "biweekly" | "monthly" | null;
  discountPercent: number | null; // 0–1 from Airtable
  discountLength: number | null;
  fiverrStatus: string | null;
  clientStripeStatus: string | null;
  subscriptionStripeId: string | null;
};

// Extract payer name from the formula `Invoice Identifier` ("{ID}-{Payer Name} | ${Amount}")
function extractPayer(identifier: string): string {
  const m = identifier.match(/^\d+-([^|]+?)\s*\|/);
  const name = m ? m[1].trim() : "";
  return name || "(unknown)";
}


export async function listAllInvoices(): Promise<MoneyInvoice[]> {
  const t = Tables.Invoices;
  const records = await listRecordsCached<{
    "Invoice ID"?: number;
    "Invoice Identifier"?: string;
    "Invoice Description"?: string;
    "Invoice Source"?: string;
    "Invoice Type"?: string;
    "Invoice Status"?: string;
    "Invoice Amount"?: number;
    "Total Airvues Margin Profit"?: number;
    "Date"?: string;
    "Created"?: string;
    "Invoice Status Last Modified"?: string;
    "Invoice Payer"?: string[];
    "Primary Email (from Invoice Payer)"?: string[];
    "Initial Invoice"?: boolean;
    "Approved by Airvues Leadership"?: boolean;
    "Invoice Stripe ID"?: string;
    "Invoice Stripe Link"?: string;
    "Subscription Stripe Link"?: string;
    "Quotes"?: string[];
  }>(
    t.id,
    {
      fields: [
        t.fields["Invoice ID"].id,
        t.fields["Invoice Identifier"].id,
        t.fields["Invoice Description"].id,
        t.fields["Invoice Source"].id,
        t.fields["Invoice Type"].id,
        t.fields["Invoice Status"].id,
        t.fields["Invoice Amount"].id,
        t.fields["Total Airvues Margin Profit"].id,
        t.fields["Date"].id,
        t.fields["Created"].id,
        t.fields["Invoice Status Last Modified"].id,
        t.fields["Invoice Payer"].id,
        // Note: Primary Email (from Invoice Payer) doesn't exist directly on Invoices —
        // it's a lookup but we'll use the Invoice Identifier name extraction instead.
        t.fields["Initial Invoice"].id,
        t.fields["Approved by Airvues Leadership"].id,
        t.fields["Invoice Stripe ID"].id,
        t.fields["Invoice Stripe Link"].id,
        t.fields["Subscription Stripe Link"].id,
        t.fields["Quotes"].id,
      ],
    },
    ["money:all-invoices"],
  );

  return records.map((r) => {
    const f = r.fields;
    const identifier = (f["Invoice Identifier"] as string) ?? "";
    return {
      id: r.id,
      invoiceId: (f["Invoice ID"] as number) ?? null,
      identifier,
      payer: extractPayer(identifier),
      payerRecordId:
        Array.isArray(f["Invoice Payer"]) && f["Invoice Payer"][0]
          ? (f["Invoice Payer"][0] as string)
          : null,
      payerEmail: null, // Filled in via separate lookup pass if needed
      source: (f["Invoice Source"] as MoneyInvoice["source"]) ?? null,
      type: (f["Invoice Type"] as MoneyInvoice["type"]) ?? null,
      status: (f["Invoice Status"] as string) ?? null,
      amount: (f["Invoice Amount"] as number) ?? 0,
      marginProfit: (f["Total Airvues Margin Profit"] as number) ?? null,
      date: (f["Date"] as string) ?? null,
      created: (f["Created"] as string) ?? null,
      lastModified: (f["Invoice Status Last Modified"] as string) ?? null,
      description: (f["Invoice Description"] as string) ?? null,
      initial: Boolean(f["Initial Invoice"]),
      approved: Boolean(f["Approved by Airvues Leadership"]),
      stripeId: (f["Invoice Stripe ID"] as string) ?? null,
      stripeLink: (f["Invoice Stripe Link"] as string) ?? null,
      subscriptionLink: (f["Subscription Stripe Link"] as string) ?? null,
      quoteRecordIds: (f["Quotes"] as string[]) ?? [],
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${t.id}/${r.id}`,
    };
  });
}
