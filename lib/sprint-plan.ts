// Sprint planning data layer (server-only). Builds engineer capacity rows +
// backlog pool from the engineering board + sprint detail.
import "server-only";

import { getEngineeringBoard } from "./engineering";
import { getSprintDetail } from "./sprints";
import { COMMISSION_RATE, Story } from "./engineering-types";
import { DEFAULT_CAPACITY_HOURS, EngineerCapacity, SprintPlan } from "./sprint-plan-types";

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

// Statuses that should NOT show up in the backlog pool when planning a sprint.
// Completed/Archived are obvious. On Hold and Analysis Required aren't ready to plan.
// Incomplete IS shown — could indicate a partial-replan candidate.
const BACKLOG_EXCLUDED = new Set([
  "Archived",
  "Completed",
  "On Hold",
  "Analysis Required",
]);

export async function getSprintPlan(sprintId: string): Promise<SprintPlan | null> {
  const [sprint, board] = await Promise.all([
    getSprintDetail(sprintId),
    getEngineeringBoard(),
  ]);
  if (!sprint) return null;

  // Per-engineer capacity rows (skip orphan pseudo-group).
  // Multi-assignee handling: hours + invoice are SPLIT evenly across assignees so
  // sum(engineer.committedHours) === sum(story.hours) at the sprint level. A 16h
  // story with 2 assignees gives each engineer 8h of personal commitment.
  const engineers: EngineerCapacity[] = [];
  for (const g of board.groups) {
    if (g.isOrphan) continue;
    const committed = sprint.stories.filter((s) => s.assigneeIds.includes(g.id));
    let committedHours = 0;
    let committedInvoice = 0;
    for (const s of committed) {
      const split = Math.max(1, s.assigneeIds.length);
      committedHours += (s.hours ?? 0) / split;
      committedInvoice += s.invoice / split;
    }
    engineers.push({
      id: g.id,
      name: g.name,
      role: g.role,
      capacity: DEFAULT_CAPACITY_HOURS,
      committedHours,
      committedStories: committed,
      committedInvoice,
      committedCommission: committedInvoice * COMMISSION_RATE,
      utilizationPct: (committedHours / DEFAULT_CAPACITY_HOURS) * 100,
    });
  }
  engineers.sort(
    (a, b) => b.committedHours - a.committedHours || a.name.localeCompare(b.name),
  );

  // Backlog pool = stories with no sprint AND status not in excluded set
  const backlog: Story[] = [];
  const seen = new Set<string>();
  for (const g of board.groups) {
    for (const s of g.stories) {
      if (seen.has(s.id)) continue;
      if (s.sprintIds.length === 0 && !BACKLOG_EXCLUDED.has(s.status ?? "")) {
        seen.add(s.id);
        backlog.push(s);
      }
    }
  }
  backlog.sort((a, b) => {
    const ra = PRIORITY_RANK[a.priority ?? ""] ?? 4;
    const rb = PRIORITY_RANK[b.priority ?? ""] ?? 4;
    if (ra !== rb) return ra - rb;
    return b.invoice - a.invoice;
  });

  const totalCapacity = engineers.length * DEFAULT_CAPACITY_HOURS;
  // With per-engineer split above, summing engineer.committedHours gives the
  // unique sprint total (no double-count from multi-assignee stories).
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
    backlog,
    totalCapacity,
    totalCommitted,
    totalFree: totalCapacity - totalCommitted,
    airtableUrl: sprint.airtableUrl,
  };
}
