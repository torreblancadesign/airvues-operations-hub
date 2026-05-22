// Personal scorecard data layer (server-only).
// Aggregates: engineering board (active stories) + Team Task Payments (real earnings)
// + People (annual earnings goal). Buckets payments + shipped stories into
// lifetime / YTD / MTD using calendar-year boundaries.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { getEngineeringBoard } from "./engineering";
import { COMMISSION_RATE } from "./engineering-types";
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
      "Commission Percentage"?: number;
    }>(
      pT.id,
      {
        // New People fields — schema.ts not yet regenerated; pass by name.
        fields: ["Annual Earnings Goal", "Commission Percentage"],
      },
      ["scorecard:people-goals"],
    ),
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

  // === Commission rate (per-person) ===
  const personRec = peopleRecords.find((r) => r.id === engineerId);
  const rawPct = personRec?.fields["Commission Percentage"] as number | undefined;
  let commissionPct = COMMISSION_RATE;
  let commissionPctSource: "person" | "default" = "default";
  if (typeof rawPct === "number" && rawPct > 0) {
    // Airtable percent fields return decimals (0.15); guard against whole-percent (15).
    commissionPct = rawPct > 1 ? rawPct / 100 : rawPct;
    commissionPctSource = "person";
  }

  // Rebuild stories + totals using per-person commission rate on Story.Cost
  // (Cost is what the engineer gets paid against; Invoice is what the client paid).
  const ratedStories = effectiveGroup.stories.map((s) => ({
    ...s,
    commission: (s.cost ?? 0) * commissionPct,
  }));

  const byStatus = {
    inProgress: ratedStories.filter((s) => s.status === "In progress"),
    todo: ratedStories.filter((s) => s.status === "Todo"),
    qa: ratedStories.filter((s) => s.status === "QA Review"),
    onHold: ratedStories.filter((s) => s.status === "On Hold" || s.status === "Incomplete"),
    done: ratedStories.filter((s) => s.status === "Completed"),
  };

  const nextToShip = ratedStories
    .filter((s) => ACTIVE_STATUSES.includes(s.status ?? ""))
    .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
    .slice(0, 3);

  // Cost-based open/earned (active = not Completed/Archived; earned = Completed).
  let openCost = 0;
  let earnedCost = 0;
  for (const s of ratedStories) {
    const c = s.cost ?? 0;
    if (s.status === "Completed") earnedCost += c;
    else if (s.status !== "Archived") openCost += c;
  }

  const totals = {
    storyCount: effectiveGroup.totals.storyCount,
    activeCount: effectiveGroup.totals.activeCount,
    doneCount: effectiveGroup.totals.doneCount,
    inProgressCount: effectiveGroup.totals.inProgressCount,
    todoCount: effectiveGroup.totals.todoCount,
    onHoldCount: effectiveGroup.totals.onHoldCount,
    qaCount: effectiveGroup.totals.qaCount,
    openInvoice: effectiveGroup.totals.openInvoice,
    earnedInvoice: effectiveGroup.totals.earnedInvoice,
    openCost,
    earnedCost,
    openCommission: openCost * commissionPct,
    earnedCommission: earnedCost * commissionPct,
  };


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
  // Prefer the real Completed Date field; fall back to latest sprint end
  // for legacy completions that pre-date the field.
  const shipped: ShippedBuckets = { lifetime: 0, ytd: 0, mtd: 0 };
  let anyApproximate = false;
  for (const s of byStatus.done) {
    shipped.lifetime++;
    let completed: Date | null = null;
    if (s.completedDate) {
      const d = new Date(s.completedDate);
      if (!isNaN(d.getTime())) completed = d;
    }
    if (!completed) {
      const ends = s.sprintEnds
        .map((d) => new Date(d))
        .filter((d) => !isNaN(d.getTime()));
      if (ends.length > 0) {
        completed = new Date(Math.max(...ends.map((d) => d.getTime())));
        anyApproximate = true;
      }
    }
    if (!completed) continue;
    if (completed >= yearStart) shipped.ytd++;
    if (completed >= monthStart) shipped.mtd++;
  }

  // === Goal ===
  const annualEarningsGoal =
    (personRec?.fields["Annual Earnings Goal"] as number | undefined) ?? null;

  const scorecard: Scorecard = {
    engineer: {
      id: effectiveGroup.id,
      name: effectiveGroup.name,
      role: effectiveGroup.role,
      internalType: effectiveGroup.internalType,
      isOrphan: effectiveGroup.isOrphan,
    },
    stories: ratedStories,
    nextToShip,
    byStatus,
    totals,
    earnings,
    shipped,
    goal: { annualEarnings: annualEarningsGoal },
    shippedIsApproximate: anyApproximate,
    commissionPct,
    commissionPctSource,
  };

  return { scorecard, engineers };
}
