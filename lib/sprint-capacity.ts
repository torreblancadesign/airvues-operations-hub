// Per-engineer per-sprint capacity overrides, backed by the 🟢 Sprint Capacity table.
// Each row links one Person to one Sprint and stores `total hours committed`
// (which we use as the **capacity** the planner can edit). When no row exists
// the planner falls back to DEFAULT_CAPACITY_HOURS.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type SprintCapacityRow = {
  id: string;
  personId: string;
  capacity: number;
};

type Row = {
  People?: string[] | { id: string }[];
  Sprint?: string[] | { id: string }[];
  "total hours committed"?: number;
};

function firstLinkedId(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const item = v[0];
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
    return (item as { id: string }).id;
  }
  return null;
}

export async function listSprintCapacities(sprintId: string): Promise<SprintCapacityRow[]> {
  if (!sprintId) return [];
  const t = Tables.SprintCapacity;
  const records = await listRecordsCached<Row>(
    t.id,
    {
      fields: [
        t.fields["People"].id,
        t.fields["Sprint"].id,
        t.fields["total hours committed"].id,
      ],
    },
    [`sprint-capacity:${sprintId}`, "sprint-capacity:all"],
  );

  const out: SprintCapacityRow[] = [];
  for (const r of records) {
    const sid = firstLinkedId(r.fields.Sprint);
    if (sid !== sprintId) continue;
    const pid = firstLinkedId(r.fields.People);
    if (!pid) continue;
    const cap = typeof r.fields["total hours committed"] === "number"
      ? (r.fields["total hours committed"] as number)
      : 0;
    out.push({ id: r.id, personId: pid, capacity: cap });
  }
  return out;
}
