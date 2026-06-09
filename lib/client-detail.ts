// Per-Company detail loader for /clients/[id]. Surfaces only fields that
// already exist in Airtable today; blueprint extensions (Industry, Lead
// Source, Discounts, Relationship Notes) are not added yet — the UI shows
// "—" for those until the fields exist in the Companies table.
import "server-only";

import { getRecord, listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { listAllInvoices, type MoneyInvoice } from "./money";
import { listAllQuotes, type PipelineQuote } from "./pipeline";

export type ClientContact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  type: string | null;
  status: string | null;
  vip: boolean;
  notes: string;
};

export type ClientDetail = {
  id: string;
  name: string;
  website: string | null;
  driveFolder: string | null;
  miroFolder: string | null;
  googleChat: string | null;
  engagement: string | null;
  contractType: string | null;
  hourlyRate: number | null;
  preferredBusiness: string | null;
  hasNDA: boolean;
  legalAddress: string | null;
  businessDescription: string;
  logo: string | null;
  createdYear: number | null;
  airtableUrl: string;
  // Aggregates
  lifetimeRevenue: number;
  outstandingAR: number;
  invoiceCount: number;
  lastInvoiceDate: string | null;
  daysSinceLastInvoice: number | null;
  // Related
  contacts: ClientContact[];
  projects: PipelineQuote[];
  invoices: MoneyInvoice[];
};

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function getClientDetail(companyId: string): Promise<ClientDetail> {
  const cT = Tables.Companies;
  const pT = Tables.People;

  const [company, people, quotes, invoices] = await Promise.all([
    getRecord<{
      Name?: string;
      Website?: string;
      "Business Description"?: string;
      "Drive Folder"?: string;
      "Miro Folder"?: string;
      "Google Chat"?: string;
      "Engagement Frequency"?: string;
      "Contract Type"?: string;
      "Hourly Rate"?: number;
      "Preferred Business"?: string;
      "Has NDA?"?: boolean;
      "Legal Address"?: string;
      Logo?: Array<{ url?: string; thumbnails?: { small?: { url?: string } } }>;
      Created?: string;
    }>(cT.id, companyId),
    listRecordsCached<{
      "Full Name"?: string;
      "First Name"?: string;
      "Last Name"?: string;
      "Primary Email"?: string;
      "Phone Number"?: string;
      Role?: string;
      Type?: string;
      Status?: string;
      "VIP Client"?: boolean;
      "Client Comments"?: string;
      Company?: string[];
    }>(
      pT.id,
      {
        filterByFormula: `FIND('${companyId}', ARRAYJOIN({${pT.fields["Company"].name ?? "Company"}}))`,
        fields: [
          pT.fields["Full Name"].id,
          pT.fields["First Name"].id,
          pT.fields["Last Name"].id,
          pT.fields["Primary Email"].id,
          pT.fields["Phone Number"].id,
          pT.fields["Role"].id,
          pT.fields["Type"].id,
          pT.fields["Status"].id,
          pT.fields["VIP Client"].id,
          pT.fields["Client Comments"].id,
          pT.fields["Company"].id,
        ],
      },
      [`client-detail:${companyId}:contacts`, "client-detail"],
    ).catch(() => []),
    listAllQuotes(),
    listAllInvoices(),
  ]);

  const cf = company.fields;

  // Contacts — keep only people whose Company actually contains this id
  // (defensive in case filterByFormula misses an edge case).
  const contacts: ClientContact[] = people
    .filter((p) => {
      const arr = p.fields["Company"];
      return Array.isArray(arr) && (arr as string[]).includes(companyId);
    })
    .map((p) => {
      const f = p.fields;
      const name =
        asStr(f["Full Name"]) ||
        [asStr(f["First Name"]), asStr(f["Last Name"])].filter(Boolean).join(" ").trim() ||
        asStr(f["Primary Email"]) ||
        "(no name)";
      return {
        id: p.id,
        name,
        title: asStr(f["Role"]) || null,
        email: asStr(f["Primary Email"]) || null,
        phone: asStr(f["Phone Number"]) || null,
        type: asStr(f["Type"]) || null,
        status: asStr(f["Status"]) || null,
        vip: f["VIP Client"] === true,
        notes: asStr(f["Client Comments"]),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Projects — quotes whose linked company includes this id
  const projects = quotes
    .filter((q) => q.companyIds.includes(companyId))
    .sort((a, b) => (b.preparedDate ?? "").localeCompare(a.preparedDate ?? ""));

  // Invoices — payer is a Person; match Person.Company contains companyId.
  // We already pulled all People for this company, so build a set of payer
  // record IDs locally.
  const payerIds = new Set(contacts.map((c) => c.id));
  const companyInvoices = invoices
    .filter((inv) => inv.payerRecordId && payerIds.has(inv.payerRecordId))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  // Aggregates from invoices
  const openish = new Set(["open", "sent", "unsent", "past due"]);
  let lifetimeRevenue = 0;
  let outstandingAR = 0;
  let lastInvoiceDate: string | null = null;
  for (const inv of companyInvoices) {
    if (inv.status === "paid") lifetimeRevenue += inv.amount;
    if (inv.status && openish.has(inv.status)) outstandingAR += inv.amount;
    if (inv.date && (!lastInvoiceDate || inv.date > lastInvoiceDate)) {
      lastInvoiceDate = inv.date;
    }
  }
  const daysSinceLastInvoice = lastInvoiceDate
    ? Math.floor((Date.now() - new Date(lastInvoiceDate).getTime()) / 86_400_000)
    : null;

  const logoArr = cf["Logo"];
  const logo =
    Array.isArray(logoArr) && logoArr[0]
      ? logoArr[0].thumbnails?.small?.url ?? logoArr[0].url ?? null
      : null;

  const created = asStr(cf["Created"]);
  const createdYear = created ? new Date(created).getFullYear() : null;

  return {
    id: company.id,
    name: asStr(cf["Name"]) || "(no name)",
    website: asStr(cf["Website"]) || null,
    driveFolder: asStr(cf["Drive Folder"]) || null,
    miroFolder: asStr(cf["Miro Folder"]) || null,
    googleChat: asStr(cf["Google Chat"]) || null,
    engagement: asStr(cf["Engagement Frequency"]) || null,
    contractType: asStr(cf["Contract Type"]) || null,
    hourlyRate: typeof cf["Hourly Rate"] === "number" ? cf["Hourly Rate"] : null,
    preferredBusiness: asStr(cf["Preferred Business"]) || null,
    hasNDA: cf["Has NDA?"] === true,
    legalAddress: asStr(cf["Legal Address"]) || null,
    businessDescription: asStr(cf["Business Description"]),
    logo,
    createdYear,
    airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${cT.id}/${company.id}`,
    lifetimeRevenue,
    outstandingAR,
    invoiceCount: companyInvoices.length,
    lastInvoiceDate,
    daysSinceLastInvoice,
    contacts,
    projects,
    invoices: companyInvoices,
  };
}
