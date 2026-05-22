// Personal scorecard data layer (server-only).
// Aggregates: engineering board (active stories) + Team Task Payments (real earnings)
// + People (annual earnings goal). Buckets payments + shipped stories into
// lifetime / YTD / MTD using calendar-year boundaries.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { getEngineeringBoard } from "./engineering";
import { Scorecard, ScorecardPayload, EarningsBuckets, ShippedBuckets } from "./scorecard-types";

const ACTIVE_STATUSES = ["Todo", "In progress", "QA Review", "Analysis Required"];

function startOfYear(now: Date): Date {
  return new Date(now.getFullYear(), 0, 1);
}
function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getScorecard(engineerId: string | null): Promise<ScorecardPayload> {
  const pT = Tables.People;
  const tT = Tables.TeamTaskPayments;

  const [board, paymentRecords, peopleRecords] = await Promise.all([
    getEngineeringBoard(),
    listRecordsCached<{
      Amount?: number;
      Status?: string;
      Date?: string;
      Payee?: { name?: string };
      "Internal Team Member Account (from Link to Expenses)"?: string[];
    }>(
      tT.id,
      {
        fields: [
          tT.fields["Amount"].id,
          tT.fields["Status"].id,
          tT.fields["Date"].id,
          tT.fields["Payee"].id,
          tT.fields["Internal Team Member Account (from Link to Expenses)"].id,
        ],
      },
      ["team:payments", "scorecard:payments"],
    ),
    listRecordsCached<{
      "Annual Earnings Goal"?: number;
    }>(
      pT.id,
      {
        // Optional field — schema may not have it yet. Airtable returns
        // unknown field names silently, so this is safe.
        fields: ["Annual Earnings Goal"],
      },
      ["scorecard:people-goals"],
    ).catch(() => [] as { id: string; fields: { "Annual Earnings Goal"?: number } }[]),
  ]);

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

  if (!group && !person) {
    return { scorecard: null, engineers };
  }

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

  // === Earnings (real money) ===
  const now = new Date();
  const yearStart = startOfYear(now);
  const monthStart = startOfMonth(now);

  const earnings: EarningsBuckets = { lifetime: 0, ytd: 0, mtd: 0, outstanding: 0 };
  for (const rec of paymentRecords) {
    const f = rec.fields;
    const lookup = f["Internal Team Member Account (from Link to Expenses)"];
    if (!lookup || lookup[0] !== engineerId) continue;
    // Exclude Airvues Consulting profit-tracking entries.
    const payeeName = (f.Payee?.name ?? "").trim().toLowerCase();
    if (payeeName === "airvues consulting") continue;

    const amt = f.Amount ?? 0;
    if (f.Status === "Needs Payment") {
      earnings.outstanding += amt;
      continue;
    }
    if (f.Status !== "Paid") continue;

    earnings.lifetime += amt;
    const d = f.Date ? new Date(f.Date) : null;
    if (d && !isNaN(d.getTime())) {
      if (d >= yearStart) earnings.ytd += amt;
      if (d >= monthStart) earnings.mtd += amt;
    }
  }

  // === Stories shipped buckets ===
  // Approximate completion date as latest sprint end on the story.
  // TODO: replace with a real Stories.Completed Date field when available.
  const shipped: ShippedBuckets = { lifetime: 0, ytd: 0, mtd: 0 };
  for (const s of byStatus.done) {
    shipped.lifetime++;
    const ends = s.sprintEnds
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()));
    if (ends.length === 0) continue;
    const latest = new Date(Math.max(...ends.map((d) => d.getTime())));
    if (latest >= yearStart) shipped.ytd++;
    if (latest >= monthStart) shipped.mtd++;
  }

  // === Goal ===
  const personGoalRec = peopleRecords.find((r) => r.id === engineerId);
  const annualEarningsGoal =
    (personGoalRec?.fields["Annual Earnings Goal"] as number | undefined) ?? null;

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
    earnings,
    shipped,
    goal: { annualEarnings: annualEarningsGoal },
    shippedIsApproximate: true,
  };

  return { scorecard, engineers };
}
