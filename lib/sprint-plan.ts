// Sprint planning data layer (server-only). Builds engineer capacity rows +
// story pool for a single sprint.
//
// Engineers: every Active person with Role = "Engineer" (so capacity rows
// exist even if they have zero stories planned).
// Pool: stories with NO sprint AND status ∈ {Todo, In progress}. Includes
// both orphans and already-assigned stories so anything plannable shows up.
// Capacity: per-engineer override from the 🟢 Sprint Capacity table; falls
// back to DEFAULT_CAPACITY_HOURS when no row exists yet.
import "server-only";

import { getEngineeringBoard } from "./engineering";
import { getSprintDetail } from "./sprints";
import { listSprintCapacities } from "./sprint-capacity";
import { Story } from "./engineering-types";
import { DEFAULT_CAPACITY_HOURS, EngineerCapacity, SprintPlan } from "./sprint-plan-types";

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

// Statuses that may appear in the "ready to plan" pool. Everything else is
// excluded — On Hold, Analysis Required, Incomplete, QA Review, Completed,
// Archived all belong elsewhere.
const POOLABLE_STATUSES = new Set(["Todo", "In progress"]);

export async function getSprintPlan(sprintId: string): Promise<SprintPlan | null> {
  const [sprint, board, capacityRows] = await Promise.all([
    getSprintDetail(sprintId),
    getEngineeringBoard(),
    listSprintCapacities(sprintId),
  ]);
  if (!sprint) return null;

  const capacityByPerson = new Map<string, number>();
  for (const row of capacityRows) capacityByPerson.set(row.personId, row.capacity);

  // Eligible engineers: Active people with role "Engineer".
  const eligible = board.assignablePeople.filter(
    (p) => (p.role ?? "").toLowerCase() === "engineer",
  );

  // Per-engineer commitment. Hours are SPLIT evenly across assignees so the
  // sprint-level totals don't double-count multi-assignee stories.
  const engineers: EngineerCapacity[] = eligible.map((p) => {
    const committed = sprint.stories.filter((s) => s.assigneeIds.includes(p.id));
    let committedHours = 0;
    for (const s of committed) {
      const split = Math.max(1, s.assigneeIds.length);
      committedHours += (s.hours ?? 0) / split;
    }
    const overrideCap = capacityByPerson.get(p.id);
    const capacity = overrideCap != null ? overrideCap : DEFAULT_CAPACITY_HOURS;
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      capacity,
      hasCapacityOverride: overrideCap != null,
      committedHours,
      committedStories: committed,
      utilizationPct: capacity > 0 ? (committedHours / capacity) * 100 : 0,
    };
  });

  engineers.sort(
    (a, b) => b.committedHours - a.committedHours || a.name.localeCompare(b.name),
  );

  // Pool = stories with no sprint AND status in {Todo, In progress}.
  // De-dup by story id (board.groups duplicates multi-assignee stories).
  const pool: Story[] = [];
  const seen = new Set<string>();
  for (const g of board.groups) {
    for (const s of g.stories) {
      if (seen.has(s.id)) continue;
      if (s.sprintIds.length > 0) continue;
      if (!POOLABLE_STATUSES.has(s.status ?? "")) continue;
      seen.add(s.id);
      pool.push(s);
    }
  }
  pool.sort((a, b) => {
    const ra = PRIORITY_RANK[a.priority ?? ""] ?? 4;
    const rb = PRIORITY_RANK[b.priority ?? ""] ?? 4;
    if (ra !== rb) return ra - rb;
    return (b.hours ?? 0) - (a.hours ?? 0);
  });

  const totalCapacity = engineers.reduce((sum, e) => sum + e.capacity, 0);
  const totalCommitted = engineers.reduce((sum, e) => sum + e.committedHours, 0);

  return {
    sprintId: sprint.id,
    sprintNumber: sprint.number,
    sprintName: sprint.name,
    sprintStatus: sprint.status,
    sprintStart: sprint.start,
    sprintEnd: sprint.end,
    sprintGoals: sprint.goals,
    engineers,
    pool,
    totalCapacity,
    totalCommitted,
    totalFree: totalCapacity - totalCommitted,
    airtableUrl: sprint.airtableUrl,
  };
}
