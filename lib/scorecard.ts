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

  const engineers = board.groups.map((g) => ({
    id: g.id,
    name: g.name,
    role: g.role,
    internalType: g.internalType,
    isOrphan: g.isOrphan,
  }));

  if (!engineerId) {
    return { scorecard: null, engineers };
  }

  const group = board.groups.find((g) => g.id === engineerId);
  if (!group) {
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
