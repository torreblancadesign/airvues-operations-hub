// Personal scorecard data layer (server-only).
// Wraps the engineering board groups + company goals for a single-engineer view.
import "server-only";

import { getEngineeringBoard } from "./engineering";
import { companyGoalsData } from "./kpi";
import { Scorecard, ScorecardPayload } from "./scorecard-types";

const ACTIVE_STATUSES = ["Todo", "In progress", "QA Review", "Analysis Required"];

export async function getScorecard(engineerId: string | null): Promise<ScorecardPayload> {
  const [board, company] = await Promise.all([
    getEngineeringBoard(),
    companyGoalsData(),
  ]);

  // Picker shows the full active internal roster — not just people with active
  // stories. board.groups is keyed by assignee on non-archived stories, so it
  // silently hides anyone between sprints, new hires, BAs, etc.
  const engineers = board.assignablePeople.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    internalType: p.internalType,
    isOrphan: false,
  }));

  if (!engineerId) {
    return { scorecard: null, engineers };
  }

  const group = board.groups.find((g) => g.id === engineerId);
  const person = board.assignablePeople.find((p) => p.id === engineerId);

  // Unknown id (not active or not internal) — fall back to picker.
  if (!group && !person) {
    return { scorecard: null, engineers };
  }


  const byStatus = {
    inProgress: group.stories.filter((s) => s.status === "In progress"),
    todo: group.stories.filter((s) => s.status === "Todo"),
    qa: group.stories.filter((s) => s.status === "QA Review"),
    onHold: group.stories.filter((s) => s.status === "On Hold" || s.status === "Incomplete"),
    done: group.stories.filter((s) => s.status === "Completed"),
  };

  const nextToShip = group.stories
    .filter((s) => ACTIVE_STATUSES.includes(s.status ?? ""))
    .sort((a, b) => b.invoice - a.invoice)
    .slice(0, 3);

  const bonusTier: Scorecard["company"]["bonusTier"] =
    company.ytdRevenue >= 750_000
      ? "tier2"
      : company.ytdRevenue >= 500_000
        ? "tier1"
        : "locked";

  const scorecard: Scorecard = {
    engineer: {
      id: group.id,
      name: group.name,
      role: group.role,
      internalType: group.internalType,
      isOrphan: group.isOrphan,
    },
    stories: group.stories,
    nextToShip,
    byStatus,
    totals: group.totals,
    company: {
      ytdRevenue: company.ytdRevenue,
      revenueGoal: 500_000,
      bonusStretch: 750_000,
      bonusTier,
    },
  };

  return { scorecard, engineers };
}
