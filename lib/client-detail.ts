// Per-Company detail loader for /clients/[id]. Surfaces only fields that
// already exist in Airtable today; blueprint extensions (Industry, Lead
// Source, Discounts, Relationship Notes) are not added yet — the UI shows
// "—" for those until the fields exist in the Companies table.
//
// IMPORTANT: We deliberately fetch People + Invoices via the same cached
// reads used by `lib/clients.ts` and filter in JS. An earlier version used
// `filterByFormula: FIND(companyId, ARRAYJOIN({Company}))` on People, but
// ARRAYJOIN on a linked-record field returns the linked records' PRIMARY
// FIELD (company name), not their recXXXX id — so the filter never matched
// and the page rendered all zeros.
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
  // Blueprint fields
  industry: string | null;
  leadSource: string | null;
  relationshipNotes: string;
  discountPct: number | null;
  discountReason: string | null;
  clientStartYearOverride: number | null;
  clientStartYear: number | null; // override ?? createdYear
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
  // Account status (sourced from the company's primary contact)
  primaryContactId: string | null;
  partnerStatus: string | null;
  leadStatus: string | null;
};

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function getClientDetail(companyId: string): Promise<ClientDetail> {
  const cT = Tables.Companies;
  const pT = Tables.People;

  const [company, allPeople, allQuotes, allInvoices] = await Promise.all([
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
      Industry?: string;
      "Lead Source"?: string;
      "Relationship Notes"?: string;
      "Discount %"?: number;
      "Discount Reason"?: string;
      "Client Start Year"?: number;
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
      ["client-detail:people"],
    ),
    listAllQuotes(),
    listAllInvoices(),
  ]);

  const cf = company.fields;
  const companyName = asStr(cf["Name"]);

  // Contacts — in-memory filter by linked Company recId.
  const contacts: ClientContact[] = allPeople
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

  // Build personId→companyId map from the full People list (matches
  // lib/clients.ts aggregation pattern). Used for both projects and invoices.
  const personToCompany = new Map<string, string>();
  for (const p of allPeople) {
    const arr = p.fields["Company"];
    if (Array.isArray(arr) && arr[0]) personToCompany.set(p.id, arr[0] as string);
  }

  // Projects — quote matches if its Existing Company lookup includes this
  // company, OR any "Prepared for" person belongs to this company. The old
  // name-based fallback was buggy: `q.client` comes from the `Client Name`
  // lookup which returns a PERSON name, not the company name.
  const projects = allQuotes
    .filter(
      (q) =>
        q.companyIds.includes(companyId) ||
        q.preparedForIds.some((pid) => personToCompany.get(pid) === companyId),
    )
    .sort((a, b) => (b.preparedDate ?? "").localeCompare(a.preparedDate ?? ""));

  // Invoices — payer is a Person; filter by the same personToCompany map.
  const companyInvoices = allInvoices
    .filter((inv) => {
      if (!inv.payerRecordId) return false;
      return personToCompany.get(inv.payerRecordId) === companyId;
    })
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
  const startYearOverride =
    typeof cf["Client Start Year"] === "number" ? cf["Client Start Year"] : null;

  return {
    id: company.id,
    name: companyName || "(no name)",
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
    industry: asStr(cf["Industry"]) || null,
    leadSource: asStr(cf["Lead Source"]) || null,
    relationshipNotes: asStr(cf["Relationship Notes"]),
    discountPct: typeof cf["Discount %"] === "number" ? cf["Discount %"] : null,
    discountReason: asStr(cf["Discount Reason"]) || null,
    clientStartYearOverride: startYearOverride,
    clientStartYear: startYearOverride ?? createdYear,
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
