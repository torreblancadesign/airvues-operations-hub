// Clients page data layer — combines Companies + Invoices to compute per-client metrics.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type PartnerStatusValue = "Lead" | "Client";
export type LeadStatusValue =
  | "New Lead"
  | "Discovery"
  | "Proposal Drafting"
  | "Proposal Sent"
  | "Won"
  | "Lost"
  | "On Hold";

export type ClientRow = {
  id: string;
  name: string;
  engagement: string;
  contractType: string | null;
  website: string | null;
  hasNDA: boolean;
  driveFolder: string | null;
  contactCount: number;
  invoiceCount: number;
  lifetimeRevenue: number;
  outstandingAR: number;
  lastInvoiceDate: string | null;
  daysSinceLastInvoice: number | null;
  airtableUrl: string;
  // Status fields — sourced from the primary contact (People record).
  primaryContactId: string | null;
  partnerStatus: PartnerStatusValue | null;
  leadStatus: LeadStatusValue | null;
};

export async function listAllClients(): Promise<ClientRow[]> {
  const cT = Tables.Companies;
  const iT = Tables.Invoices;
  const pT = Tables.People;

  // Pull Companies + Invoices in parallel
  const [companies, invoices, people] = await Promise.all([
    listRecordsCached<{
      Name?: string;
      Website?: string;
      "Engagement Frequency"?: string;
      "Contract Type"?: string;
      "Has NDA?"?: boolean;
      "Drive Folder"?: string;
      "Client List (Employees)"?: string[];
    }>(
      cT.id,
      {
        fields: [
          cT.fields["Name"].id,
          cT.fields["Website"].id,
          cT.fields["Engagement Frequency"].id,
          cT.fields["Contract Type"].id,
          cT.fields["Has NDA?"].id,
          cT.fields["Drive Folder"].id,
          cT.fields["Client List (Employees)"].id,
        ],
      },
      ["clients:companies"],
    ),
    listRecordsCached<{
      "Invoice Amount"?: number;
      "Invoice Status"?: string;
      Date?: string;
      "Invoice Payer"?: string[];
    }>(
      iT.id,
      {
        fields: [
          iT.fields["Invoice Amount"].id,
          iT.fields["Invoice Status"].id,
          iT.fields["Date"].id,
          iT.fields["Invoice Payer"].id,
        ],
      },
      ["clients:invoices"],
    ),
    listRecordsCached<{
      Company?: string[];
      "Partner Status"?: string;
      "Lead Status"?: string;
    }>(
      pT.id,
      {
        fields: [
          pT.fields["Company"].id,
          pT.fields["Partner Status"].id,
          pT.fields["Lead Status"].id,
        ],
      },
      ["clients:people"],
    ),
  ]);

  // People → Company. Also pick a primary contact per Company:
  //   prefer a person with Partner Status set; else the first one we see.
  const personIdToCompanyId = new Map<string, string>();
  type Primary = { personId: string; partner: string | null; lead: string | null };
  const primaryByCompany = new Map<string, Primary>();
  for (const p of people) {
    const companyArr = (p.fields["Company"] as string[] | undefined) ?? [];
    const companyId = companyArr[0];
    if (!companyId) continue;
    personIdToCompanyId.set(p.id, companyId);
    const partner = (p.fields["Partner Status"] as string | undefined) ?? null;
    const lead = (p.fields["Lead Status"] as string | undefined) ?? null;
    const existing = primaryByCompany.get(companyId);
    if (!existing || (!existing.partner && partner)) {
      primaryByCompany.set(companyId, { personId: p.id, partner, lead });
    }
  }

  // Aggregate per Company
  type Agg = { count: number; revenue: number; outstanding: number; lastDate: string | null };
  const agg = new Map<string, Agg>();

  const openish = ["open", "sent", "unsent", "past due"];

  for (const inv of invoices) {
    const f = inv.fields;
    const payerId = ((f["Invoice Payer"] as string[] | undefined) ?? [])[0];
    if (!payerId) continue;
    const companyId = personIdToCompanyId.get(payerId);
    if (!companyId) continue;

    const amt = (f["Invoice Amount"] as number) ?? 0;
    const status = f["Invoice Status"] as string | undefined;
    const date = f["Date"] as string | undefined;

    const a = agg.get(companyId) ?? { count: 0, revenue: 0, outstanding: 0, lastDate: null };
    a.count += 1;
    if (status === "paid") a.revenue += amt;
    if (status && openish.includes(status)) a.outstanding += amt;
    if (date && (!a.lastDate || date > a.lastDate)) a.lastDate = date;
    agg.set(companyId, a);
  }

  const now = Date.now();

  return companies.map((c) => {
    const f = c.fields;
    const a = agg.get(c.id) ?? { count: 0, revenue: 0, outstanding: 0, lastDate: null };
    const daysSinceLast = a.lastDate
      ? Math.floor((now - new Date(a.lastDate).getTime()) / 86_400_000)
      : null;
    return {
      id: c.id,
      name: (f["Name"] as string) ?? "(no name)",
      engagement: (f["Engagement Frequency"] as string) ?? "—",
      contractType: (f["Contract Type"] as string) ?? null,
      website: (f["Website"] as string) ?? null,
      hasNDA: Boolean(f["Has NDA?"]),
      driveFolder: (f["Drive Folder"] as string) ?? null,
      contactCount: Array.isArray(f["Client List (Employees)"])
        ? (f["Client List (Employees)"] as string[]).length
        : 0,
      invoiceCount: a.count,
      lifetimeRevenue: a.revenue,
      outstandingAR: a.outstanding,
      lastInvoiceDate: a.lastDate,
      daysSinceLastInvoice: daysSinceLast,
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${cT.id}/${c.id}`,
      primaryContactId: primaryByCompany.get(c.id)?.personId ?? null,
      partnerStatus: (primaryByCompany.get(c.id)?.partner as PartnerStatusValue | null) ?? null,
      leadStatus: (primaryByCompany.get(c.id)?.lead as LeadStatusValue | null) ?? null,
    };
  });
}
