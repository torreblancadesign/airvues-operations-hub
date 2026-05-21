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
  createdTime: string;               // ISO datetime
  daysToMeeting: number | null;
  assessor: string | null;
  quotesCount: number;
  quoteStatuses: string[];
  airtableUrl: string;
};

function first<T>(x: T[] | undefined): T | null {
  return Array.isArray(x) && x.length > 0 ? x[0] : null;
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
      ],
    },
    ["leads:all"],
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      name: (f["Name"] as string) ?? "(no name)",
      firstName: (f["First Name"] as string) ?? null,
      lastName: (f["Last Name"] as string) ?? null,
      email: (f["Email"] as string) ?? null,
      company: (f["Company Name"] as string) ?? null,
      title: (f["Title"] as string) ?? null,
      budget: (f["Budget"] as LeadBudget) ?? null,
      source: (f["Source"] as LeadSource) ?? null,
      status: (f["Status"] as LeadStatus) ?? null,
      meetingDate: (f["Meeting Date"] as string) ?? null,
      endMeetingDate: (f["End Meeting Date"] as string) ?? null,
      meetingLink: (f["Meeting Link"] as string) ?? null,
      whatToBuild: (f["What are you looking to build?"] as string) ?? null,
      clientIntro: (f["Client Introduction"] as string) ?? null,
      transcript: (f["Paste Meeting Transcript"] as string) ?? null,
      createdTime: (f["Created Time"] as string) ?? r.createdTime,
      daysToMeeting: typeof f["Days to Meeting"] === "number" ? (f["Days to Meeting"] as number) : null,
      assessor: first(f["Team Member Lead Assesser"] as string[] | undefined) ?? null,
      quotesCount: Array.isArray(f["\u26aa\ufe0f Quotes"]) ? (f["\u26aa\ufe0f Quotes"] as string[]).length : 0,
      quoteStatuses: (f["Status (from \u26aa\ufe0f Quotes)"] as string[]) ?? [],
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${t.id}/${r.id}`,
    };
  });
}
