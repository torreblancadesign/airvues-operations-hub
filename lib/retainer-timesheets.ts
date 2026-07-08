// Retainer Timesheets — lightweight list of retainer-agreement quotes for the
// engineer-facing timesheet page. Each entry gives the engineer enough info to
// pick a retainer to log stories against. Detailed story data is fetched via
// getQuoteDetail() on demand when a retainer is selected.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type RetainerListItem = {
  id: string;
  projectName: string;
  clientName: string | null;
  dealStage: string | null; // Quote.Status
  projectStatus: string | null;
  storiesCount: number;
  totalHours: number | null;
};

function firstStr(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
  return null;
}

export async function listRetainers(): Promise<RetainerListItem[]> {
  const t = Tables.Quotes;
  const rows = await listRecordsCached<{
    "Project Name"?: string;
    "Client Name"?: string[];
    "Proposal Type"?: string;
    "Status"?: string;
    "Project Status"?: string;
    "Stories"?: string[];
    "Total Hours"?: number;
  }>(
    t.id,
    {
      fields: [
        t.fields["Project Name"].id,
        t.fields["Client Name"].id,
        t.fields["Proposal Type"].id,
        t.fields["Status"].id,
        t.fields["Project Status"].id,
        t.fields["Stories"].id,
        t.fields["Total Hours"].id,
      ],
      filterByFormula: `AND({Proposal Type} = 'Retainer Agreement', {Status} = 'Approved and Signed')`,
    },
    ["retainer-timesheets:list"],
  );

  const items: RetainerListItem[] = rows.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      projectName: (f["Project Name"] as string) ?? "(no name)",
      clientName: firstStr(f["Client Name"]),
      dealStage: (f["Status"] as string) ?? null,
      projectStatus: (f["Project Status"] as string) ?? null,
      storiesCount: Array.isArray(f["Stories"]) ? (f["Stories"] as string[]).length : 0,
      totalHours: typeof f["Total Hours"] === "number" ? (f["Total Hours"] as number) : null,
    };
  });

  // Sort: active (not Rejected/Cancelled/Lost) first, then by client, then project.
  const INACTIVE = new Set(["Rejected", "Cancelled"]);
  return items.sort((a, b) => {
    const aInactive = a.dealStage ? INACTIVE.has(a.dealStage) : false;
    const bInactive = b.dealStage ? INACTIVE.has(b.dealStage) : false;
    if (aInactive !== bInactive) return aInactive ? 1 : -1;
    const ac = (a.clientName ?? "").localeCompare(b.clientName ?? "");
    if (ac !== 0) return ac;
    return a.projectName.localeCompare(b.projectName);
  });
}

export function isRetainerActive(item: RetainerListItem): boolean {
  const s = item.dealStage;
  if (!s) return true;
  return s !== "Rejected" && s !== "Cancelled";
}
