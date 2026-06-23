// Pipeline page data layer — fetches all Quotes once with the fields needed for the
// operational dashboard (filter/sort/drill-in).
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { computeDeadlineRisk } from "./deadline";
import type { DeadlineRisk } from "@/components/pipeline/types";

export type PipelineQuote = {
  id: string;
  autonumber: number | null;
  projectName: string;
  client: string;
  preparedBy: string;
  status: string | null;
  projectStatus: string | null;
  proposalType: string | null;
  totalCost: number;
  totalHours: number | null;
  totalPaid: number;
  amountOwed: number;
  preparedDate: string | null;
  signedDate: string | null;
  expirationDate: string | null;
  deliveryDueDate: string | null;
  deadlineRisk: DeadlineRisk;
  quoteLastAccess: string | null;
  created: string | null;
  storiesCount: number;
  webQuoteUrl: string;
  airtableUrl: string;
  primaryEmail: string | null;
  company: string | null;
  companyIds: string[];
  preparedForIds: string[];
};


function first<T>(x: T[] | undefined): T | null {
  return Array.isArray(x) && x.length > 0 ? x[0] : null;
}

export async function listAllQuotes(): Promise<PipelineQuote[]> {
  const t = Tables.Quotes;
  const records = await listRecordsCached<{
    Autonumber?: number;
    "Project Name"?: string;
    "Client Name"?: string[];
    "Prepared By Name"?: string[];
    "Status"?: string;
    "Project Status"?: string;
    "Proposal Type"?: string;
    "Total Cost"?: number;
    "Total Hours"?: number;
    "Total Paid"?: number;
    "Amount Owed"?: number;
    "Prepared Date"?: string;
    "Signed Date"?: string;
    "Quote Expiration Date"?: string;
    "Client Delivery Due Date"?: string;
    "Quote Last Access"?: string;
    "Created"?: string;
    "Stories"?: string[];
    "Primary Email (from Prepared for)"?: string[];
    "Company Name"?: string[];
    "Existing Company? (from Form Submission)"?: string[];
    "Prepared for"?: string[];
  }>(
    t.id,
    {
      fields: [
        t.fields["Autonumber"].id,
        t.fields["Project Name"].id,
        t.fields["Client Name"].id,
        t.fields["Prepared By Name"].id,
        t.fields["Status"].id,
        t.fields["Project Status"].id,
        t.fields["Proposal Type"].id,
        t.fields["Total Cost"].id,
        t.fields["Total Hours"].id,
        t.fields["Total Paid"].id,
        t.fields["Amount Owed"].id,
        t.fields["Prepared Date"].id,
        t.fields["Signed Date"].id,
        t.fields["Quote Expiration Date"].id,
        t.fields["Client Delivery Due Date"].id,
        t.fields["Quote Last Access"].id,
        t.fields["Created"].id,
        t.fields["Stories"].id,
        t.fields["Primary Email (from Prepared for)"].id,
        t.fields["Company Name"].id,
        t.fields["Existing Company? (from Form Submission)"].id,
        t.fields["Prepared for"].id,
      ],
    },
    ["pipeline:all-quotes"],
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      autonumber: (f["Autonumber"] as number) ?? null,
      projectName: (f["Project Name"] as string) ?? "(no name)",
      client: first(f["Client Name"] as string[] | undefined) ?? "—",
      preparedBy: first(f["Prepared By Name"] as string[] | undefined) ?? "—",
      status: (f["Status"] as string) ?? null,
      projectStatus: (f["Project Status"] as string) ?? null,
      proposalType: (f["Proposal Type"] as string) ?? null,
      totalCost: (f["Total Cost"] as number) ?? 0,
      totalHours: (f["Total Hours"] as number) ?? null,
      totalPaid: (f["Total Paid"] as number) ?? 0,
      amountOwed: (f["Amount Owed"] as number) ?? 0,
      preparedDate: (f["Prepared Date"] as string) ?? null,
      signedDate: (f["Signed Date"] as string) ?? null,
      expirationDate: (f["Quote Expiration Date"] as string) ?? null,
      deliveryDueDate: (f["Client Delivery Due Date"] as string) ?? null,
      deadlineRisk: computeDeadlineRisk((f["Client Delivery Due Date"] as string) ?? null),
      quoteLastAccess: (f["Quote Last Access"] as string) ?? null,
      created: (f["Created"] as string) ?? null,
      storiesCount: Array.isArray(f["Stories"]) ? (f["Stories"] as string[]).length : 0,
      webQuoteUrl: `https://airvues-quote.vercel.app/?quoteId=${r.id}`,
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${t.id}/${r.id}`,
      primaryEmail: first(f["Primary Email (from Prepared for)"] as string[] | undefined),
      companyIds: Array.isArray(f["Existing Company? (from Form Submission)"])
        ? (f["Existing Company? (from Form Submission)"] as string[])
        : [],
      preparedForIds: Array.isArray(f["Prepared for"])
        ? (f["Prepared for"] as string[])
        : [],
    };
  });
}
