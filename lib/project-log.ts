// Server-only reader for the Project Log table. Returns events for a given
// project, account, or recent global feed. Cached with per-project tags so
// writes can invalidate just the affected timeline.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import type { ProjectLogEntry } from "./project-log-types";

type RawFields = {
  Account?: string[];
  Project?: string[];
  "Event Type"?: string;
  Timestamp?: string;
  Detail?: string;
};

function mapRow(r: { id: string; fields: RawFields }): ProjectLogEntry {
  const f = r.fields;
  return {
    id: r.id,
    accountId: (f.Account ?? [])[0] ?? null,
    projectId: (f.Project ?? [])[0] ?? null,
    eventType: f["Event Type"] ?? "Event",
    timestamp: f.Timestamp ?? "",
    detail: f.Detail ?? "",
  };
}

const FIELDS = [
  Tables.ProjectLog.fields["Account"].id,
  Tables.ProjectLog.fields["Project"].id,
  Tables.ProjectLog.fields["Event Type"].id,
  Tables.ProjectLog.fields["Timestamp"].id,
  Tables.ProjectLog.fields["Detail"].id,
];

export async function listProjectLogForProject(projectId: string): Promise<ProjectLogEntry[]> {
  if (!projectId) return [];
  const filter = `FIND('${projectId}', ARRAYJOIN({${"Project"}}))`;
  const rows = await listRecordsCached<RawFields>(
    Tables.ProjectLog.id,
    {
      fields: FIELDS,
      filterByFormula: filter,
      sort: [{ field: Tables.ProjectLog.fields["Timestamp"].id, direction: "desc" }],
      maxRecords: 200,
    },
    [`project-log:${projectId}`],
  );
  return rows.map(mapRow);
}

export async function listProjectLogForAccount(accountId: string): Promise<ProjectLogEntry[]> {
  if (!accountId) return [];
  const filter = `FIND('${accountId}', ARRAYJOIN({${"Account"}}))`;
  const rows = await listRecordsCached<RawFields>(
    Tables.ProjectLog.id,
    {
      fields: FIELDS,
      filterByFormula: filter,
      sort: [{ field: Tables.ProjectLog.fields["Timestamp"].id, direction: "desc" }],
      maxRecords: 200,
    },
    [`project-log:account:${accountId}`],
  );
  return rows.map(mapRow);
}
