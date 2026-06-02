// Server reads for the Meetings (meeting recorder + AI notes) feature.
//
// AIRTABLE TABLE: "Meetings" (created manually).
// Required Long-text fields: Transcript, Summary, Key Decisions, Action Items,
// Follow-up Questions. Plus: Title (single line), Lead (link → Leads),
// Owner (link → People), Owner Name (lookup), Lead Name (lookup),
// Duration (s) (number), Audio URL (url), Size (MB) (number),
// Source (single select: meet/zoom/manual/other),
// Status (single select: Processing/Ready/Failed), Deleted (checkbox).
import "server-only";

import { listRecordsCached } from "./airtable";
import type { Meeting, MeetingSource, MeetingStatus } from "./meetings-types";

export const MEETINGS_TABLE = "Meetings";

type MeetingRow = {
  Title?: string;
  Owner?: string[];
  "Owner Name"?: string[];
  "Duration (s)"?: number;
  "Audio URL"?: string;
  "Size (MB)"?: number;
  Source?: string;
  Status?: string;
  Lead?: string[];
  "Lead Name"?: string[];
  Transcript?: string;
  Summary?: string;
  "Key Decisions"?: string;
  "Action Items"?: string;
  "Follow-up Questions"?: string;
  Deleted?: boolean;
};

const FIELDS = [
  "Title",
  "Owner",
  "Owner Name",
  "Duration (s)",
  "Audio URL",
  "Size (MB)",
  "Source",
  "Status",
  "Lead",
  "Lead Name",
  "Transcript",
  "Summary",
  "Key Decisions",
  "Action Items",
  "Follow-up Questions",
  "Deleted",
];

function normSource(v: string | undefined): MeetingSource {
  if (v === "meet" || v === "zoom" || v === "manual" || v === "other") return v;
  return "other";
}

function normStatus(v: string | undefined): MeetingStatus {
  if (v === "Processing" || v === "Ready" || v === "Failed") return v;
  return "Processing";
}

function toMeeting(rec: { id: string; createdTime: string; fields: MeetingRow }): Meeting {
  const f = rec.fields;
  return {
    id: rec.id,
    title: f.Title ?? "Untitled meeting",
    ownerId: f.Owner?.[0] ?? null,
    ownerName: f["Owner Name"]?.[0] ?? null,
    createdAt: rec.createdTime,
    durationSec: f["Duration (s)"] ?? 0,
    audioUrl: f["Audio URL"] ?? "",
    sizeMb: f["Size (MB)"] ?? null,
    source: normSource(f.Source),
    status: normStatus(f.Status),
    linkedLeadId: f.Lead?.[0] ?? null,
    linkedLeadName: f["Lead Name"]?.[0] ?? null,
    transcript: f.Transcript ?? null,
    summary: f.Summary ?? null,
    keyDecisions: f["Key Decisions"] ?? null,
    actionItems: f["Action Items"] ?? null,
    questions: f["Follow-up Questions"] ?? null,
  };
}

export async function listAllMeetings(): Promise<Meeting[]> {
  const records = await listRecordsCached<MeetingRow>(
    MEETINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `NOT({Deleted})`,
      sort: [{ field: "Created", direction: "desc" }],
    },
    ["meetings"],
  );
  return records.map(toMeeting);
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const records = await listRecordsCached<MeetingRow>(
    MEETINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `RECORD_ID() = "${id}"`,
      maxRecords: 1,
    },
    [`meetings:id:${id}`],
  );
  return records[0] ? toMeeting(records[0]) : null;
}

export async function listMeetingsForLead(leadId: string): Promise<Meeting[]> {
  const records = await listRecordsCached<MeetingRow>(
    MEETINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `AND(NOT({Deleted}), FIND("${leadId}", ARRAYJOIN({Lead})))`,
      sort: [{ field: "Created", direction: "desc" }],
    },
    [`meetings:lead:${leadId}`],
  );
  return records.map(toMeeting);
}
