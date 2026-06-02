// Server reads for the Loops (internal screen recorder) feature.
//
// AIRTABLE TABLE: "Recordings" (created manually — see docs in plan).
// Field names used here MUST match exactly. Field IDs will be added to
// lib/schema.ts via the schema regenerator after the table exists.
import "server-only";

import { listRecordsCached } from "./airtable";
import type { Loop, LoopLinkKind } from "./loops-types";

export const RECORDINGS_TABLE = "Recordings";

type RecordingRow = {
  Title?: string;
  Owner?: string[]; // linked → People
  "Owner Name"?: string[]; // lookup → People.Full Name
  "Duration (s)"?: number;
  "Video URL"?: string;
  "Poster URL"?: string;
  "Size (MB)"?: number;
  "Share Token"?: string;
  "View Count"?: number;
  "Linked Client"?: string[];
  "Linked Quote"?: string[];
  "Linked Story"?: string[];
  "Linked Lead"?: string[];
  "Linked Client Name"?: string[]; // lookups (optional, nice-to-have)
  "Linked Quote Name"?: string[];
  "Linked Story Name"?: string[];
  "Linked Lead Name"?: string[];
  Transcript?: string;
  Summary?: string;
  "Key Notes"?: string;
  "Action Items"?: string;
  "Client Questions"?: string;
  Deleted?: boolean;
};

const FIELDS = [
  "Title",
  "Owner",
  "Owner Name",
  "Duration (s)",
  "Video URL",
  "Poster URL",
  "Size (MB)",
  "Share Token",
  "View Count",
  "Linked Client",
  "Linked Quote",
  "Linked Story",
  "Linked Lead",
  "Linked Client Name",
  "Linked Quote Name",
  "Linked Story Name",
  "Linked Lead Name",
  "Transcript",
  "Summary",
  "Key Notes",
  "Action Items",
  "Client Questions",
  "Deleted",
];

function toLoop(rec: { id: string; createdTime: string; fields: RecordingRow }): Loop {
  const f = rec.fields;
  let linkKind: LoopLinkKind = null;
  let linkedId: string | null = null;
  let linkedLabel: string | null = null;
  if (f["Linked Client"]?.[0]) {
    linkKind = "client";
    linkedId = f["Linked Client"][0];
    linkedLabel = f["Linked Client Name"]?.[0] ?? null;
  } else if (f["Linked Quote"]?.[0]) {
    linkKind = "quote";
    linkedId = f["Linked Quote"][0];
    linkedLabel = f["Linked Quote Name"]?.[0] ?? null;
  } else if (f["Linked Story"]?.[0]) {
    linkKind = "story";
    linkedId = f["Linked Story"][0];
    linkedLabel = f["Linked Story Name"]?.[0] ?? null;
  } else if (f["Linked Lead"]?.[0]) {
    linkKind = "lead";
    linkedId = f["Linked Lead"][0];
    linkedLabel = f["Linked Lead Name"]?.[0] ?? null;
  }
  return {
    id: rec.id,
    title: f.Title ?? "Untitled recording",
    ownerId: f.Owner?.[0] ?? null,
    ownerName: f["Owner Name"]?.[0] ?? null,
    createdAt: rec.createdTime,
    durationSec: f["Duration (s)"] ?? 0,
    videoUrl: f["Video URL"] ?? "",
    posterUrl: f["Poster URL"] ?? null,
    sizeMb: f["Size (MB)"] ?? null,
    shareToken: f["Share Token"] ?? "",
    viewCount: f["View Count"] ?? 0,
    linkKind,
    linkedId,
    linkedLabel,
    linkedClientId: f["Linked Client"]?.[0] ?? null,
    linkedClientName: f["Linked Client Name"]?.[0] ?? null,
    linkedQuoteId: f["Linked Quote"]?.[0] ?? null,
    linkedQuoteName: f["Linked Quote Name"]?.[0] ?? null,
  };
}

export async function listAllLoops(): Promise<Loop[]> {
  const records = await listRecordsCached<RecordingRow>(
    RECORDINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `NOT({Deleted})`,
      sort: [{ field: "Created", direction: "desc" }],
    },
    ["loops"],
  );
  return records.map(toLoop);
}

export async function listLoopsForOwner(ownerId: string): Promise<Loop[]> {
  const records = await listRecordsCached<RecordingRow>(
    RECORDINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `AND(NOT({Deleted}), FIND("${ownerId}", ARRAYJOIN({Owner})))`,
      sort: [{ field: "Created", direction: "desc" }],
    },
    [`loops:owner:${ownerId}`],
  );
  return records.map(toLoop);
}

export async function getLoopById(id: string): Promise<Loop | null> {
  const records = await listRecordsCached<RecordingRow>(
    RECORDINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `RECORD_ID() = "${id}"`,
      maxRecords: 1,
    },
    [`loops:id:${id}`],
  );
  return records[0] ? toLoop(records[0]) : null;
}

export async function getLoopByToken(token: string): Promise<Loop | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const records = await listRecordsCached<RecordingRow>(
    RECORDINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `AND(NOT({Deleted}), {Share Token} = "${token}")`,
      maxRecords: 1,
    },
    [`loops:token:${token}`],
  );
  return records[0] ? toLoop(records[0]) : null;
}

export async function listLoopsLinkedTo(
  kind: Exclude<LoopLinkKind, null>,
  recordId: string,
): Promise<Loop[]> {
  const fieldName = {
    client: "Linked Client",
    quote: "Linked Quote",
    story: "Linked Story",
    lead: "Linked Lead",
  }[kind];
  const records = await listRecordsCached<RecordingRow>(
    RECORDINGS_TABLE,
    {
      fields: FIELDS,
      filterByFormula: `AND(NOT({Deleted}), FIND("${recordId}", ARRAYJOIN({${fieldName}})))`,
      sort: [{ field: "Created", direction: "desc" }],
    },
    [`loops:linked:${kind}:${recordId}`],
  );
  return records.map(toLoop);
}
