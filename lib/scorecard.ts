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


  // Synthesize an empty group for active people with no current stories.
  const effectiveGroup = group ?? {
    id: person!.id,
    name: person!.name,
    role: person!.role,
    internalType: person!.internalType,
    isOrphan: false,
    stories: [],
    totals: {
      storyCount: 0,
      activeCount: 0,
      doneCount: 0,
      inProgressCount: 0,
      todoCount: 0,
      onHoldCount: 0,
      qaCount: 0,
      openInvoice: 0,
      openCommission: 0,
      earnedInvoice: 0,
      earnedCommission: 0,
    },
  };

  const byStatus = {
    inProgress: effectiveGroup.stories.filter((s) => s.status === "In progress"),
    todo: effectiveGroup.stories.filter((s) => s.status === "Todo"),
    qa: effectiveGroup.stories.filter((s) => s.status === "QA Review"),
    onHold: effectiveGroup.stories.filter((s) => s.status === "On Hold" || s.status === "Incomplete"),
    done: effectiveGroup.stories.filter((s) => s.status === "Completed"),
  };

  const nextToShip = effectiveGroup.stories
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
      id: effectiveGroup.id,
      name: effectiveGroup.name,
      role: effectiveGroup.role,
      internalType: effectiveGroup.internalType,
      isOrphan: effectiveGroup.isOrphan,
    },
    stories: effectiveGroup.stories,
    nextToShip,
    byStatus,
    totals: effectiveGroup.totals,
    company: {
      ytdRevenue: company.ytdRevenue,
      revenueGoal: 500_000,
      bonusStretch: 750_000,
      bonusTier,
    },
  };

  return { scorecard, engineers };
}

