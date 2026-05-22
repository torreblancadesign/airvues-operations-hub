// Leads page data layer — fetches all rows from the ⚪️ Leads table.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type LeadStatus =
  | "New Lead"
  | "Needs Review"
  | "In Proposal Stage"
  | "Sold"
  | "Not Sold";

export type LeadBudget = "<$500" | "$1000 - $2000" | "$5000+";

export type LeadSource = "Manually Scheduled" | "From Fillout";

export type LeadAttachment = {
  id: string;
  filename: string;
  url: string;
  type: string | null;
  size: number | null;
};

export type Lead = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  budget: LeadBudget | null;
  source: LeadSource | null;
  status: LeadStatus | null;
  meetingDate: string | null;        // ISO datetime
  endMeetingDate: string | null;     // ISO datetime (formula)
  meetingLink: string | null;
  whatToBuild: string | null;
  clientIntro: string | null;
  transcript: string | null;
  attachments: LeadAttachment[];
  createdTime: string;               // ISO datetime
  daysToMeeting: number | null;
  assessorId: string | null;
  assessorName: string | null;
  quotesCount: number;
  quoteStatuses: string[];
  airtableUrl: string;
};

function first<T>(x: T[] | undefined): T | null {
  return Array.isArray(x) && x.length > 0 ? x[0] : null;
}

// Airtable AI fields return { state, value, isStale } objects, not plain strings.
// Normalize to a string for safe rendering.
function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.length > 0 ? v : null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(asText).filter((s): s is string => !!s);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof v === "object") {
    const obj = v as { value?: unknown };
    if ("value" in obj) return asText(obj.value);
    return null;
  }
  return null;
}

export async function listAllLeads(): Promise<Lead[]> {
  const t = Tables.Leads;
  const records = await listRecordsCached<{
    Name?: string;
    "First Name"?: string;
    "Last Name"?: string;
    Email?: string;
    "Company Name"?: string;
    Title?: string;
    Budget?: string;
    Source?: string;
    Status?: string;
    "Meeting Date"?: string;
    "End Meeting Date"?: string;
    "Meeting Link"?: string;
    "What are you looking to build?"?: string;
    "Client Introduction"?: string;
    "Paste Meeting Transcript"?: string;
    "Created Time"?: string;
    "Days to Meeting"?: number;
    "Team Member Lead Assesser"?: string[];
    "\u26aa\ufe0f Quotes"?: string[];
    "Status (from \u26aa\ufe0f Quotes)"?: string[];
    "Attach Supporting Documentations"?: Array<{ id: string; filename?: string; url?: string; type?: string; size?: number }>;
  }>(
    t.id,
    {
      fields: [
        t.fields["Name"].id,
        t.fields["First Name"].id,
        t.fields["Last Name"].id,
        t.fields["Email"].id,
        t.fields["Company Name"].id,
        t.fields["Title"].id,
        t.fields["Budget"].id,
        t.fields["Source"].id,
        t.fields["Status"].id,
        t.fields["Meeting Date"].id,
        t.fields["End Meeting Date"].id,
        t.fields["Meeting Link"].id,
        t.fields["What are you looking to build?"].id,
        t.fields["Client Introduction"].id,
        t.fields["Paste Meeting Transcript"].id,
        t.fields["Created Time"].id,
        t.fields["Days to Meeting"].id,
        t.fields["Team Member Lead Assesser"].id,
        t.fields["\u26aa\ufe0f Quotes"].id,
        t.fields["Status (from \u26aa\ufe0f Quotes)"].id,
        t.fields["Attach Supporting Documentations"].id,
      ],
    },
    ["leads:all"],
  );

  // Collect all unique assessor recIds and resolve to Full Name via People table.
  const assessorIds = new Set<string>();
  for (const r of records) {
    const ids = r.fields["Team Member Lead Assesser"] as string[] | undefined;
    if (Array.isArray(ids)) ids.forEach((id) => assessorIds.add(id));
  }

  const nameById = new Map<string, string>();
  if (assessorIds.size > 0) {
    const ids = Array.from(assessorIds);
    const formula = `OR(${ids.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
    const people = await listRecordsCached<{ "Full Name"?: string; "First Name"?: string; "Last Name"?: string }>(
      Tables.People.id,
      {
        fields: [
          Tables.People.fields["Full Name"].id,
          Tables.People.fields["First Name"].id,
          Tables.People.fields["Last Name"].id,
        ],
        filterByFormula: formula,
      },
      ["people:lead-assessors"],
    );
    for (const p of people) {
      const fullName = asText(p.fields["Full Name"]);
      const composed = [asText(p.fields["First Name"]), asText(p.fields["Last Name"])].filter(Boolean).join(" ").trim();
      const name = fullName ?? (composed.length > 0 ? composed : null);
      if (name) nameById.set(p.id, name);
    }
  }

  return records.map((r) => {
    const f = r.fields;
    const assessorId = first(f["Team Member Lead Assesser"] as string[] | undefined) ?? null;
    return {
      id: r.id,
      name: asText(f["Name"]) ?? "(no name)",
      firstName: asText(f["First Name"]),
      lastName: asText(f["Last Name"]),
      email: asText(f["Email"]),
      company: asText(f["Company Name"]),
      title: asText(f["Title"]),
      budget: (f["Budget"] as LeadBudget) ?? null,
      source: (f["Source"] as LeadSource) ?? null,
      status: (f["Status"] as LeadStatus) ?? null,
      meetingDate: (f["Meeting Date"] as string) ?? null,
      endMeetingDate: (f["End Meeting Date"] as string) ?? null,
      meetingLink: asText(f["Meeting Link"]),
      whatToBuild: asText(f["What are you looking to build?"]),
      clientIntro: asText(f["Client Introduction"]),
      transcript: asText(f["Paste Meeting Transcript"]),
      attachments: (f["Attach Supporting Documentations"] ?? []).map((a) => ({
        id: a.id,
        filename: a.filename ?? "file",
        url: a.url ?? "",
        type: a.type ?? null,
        size: typeof a.size === "number" ? a.size : null,
      })),
      createdTime: (f["Created Time"] as string) ?? r.createdTime,
      daysToMeeting: typeof f["Days to Meeting"] === "number" ? (f["Days to Meeting"] as number) : null,
      assessorId,
      assessorName: assessorId ? nameById.get(assessorId) ?? null : null,
      quotesCount: Array.isArray(f["\u26aa\ufe0f Quotes"]) ? (f["\u26aa\ufe0f Quotes"] as string[]).length : 0,
      quoteStatuses: (f["Status (from \u26aa\ufe0f Quotes)"] as string[]) ?? [],
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${t.id}/${r.id}`,
    };
  });
}

