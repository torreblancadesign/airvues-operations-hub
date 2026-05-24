// Aggregated home-page hero: pulls together the most important firm-wide
// numbers from Earnings (Invoices) and Pipeline (Quotes) in one cached call.
// Time-bound tiles (revenue, booked, conversion) are returned for both YTD
// and MTD windows so the UI can toggle without a refetch.
import "server-only";

import { revenueYtd, revenueMtd, mrr, openReceivables } from "./kpi";
import { listAllQuotes } from "./pipeline";
import { listAllLeads } from "./leads";
import { listAllInvoices } from "./money";
import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

const OPEN_STATUSES = ["Draft", "Sent. Awaiting Approval.", "Auditing 🚩"];
const ACTIVE_STATUSES = ["Approved and Signed", "Awaiting Payment", "Project In Progress"];
// "Sold" = project actually started (initial invoice paid).
const SOLD_STATUSES = ["Project In Progress", "Paid"];

const daysSince = (iso: string | null): number => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export type TrendPoint = { label: string; value: number };

export type RevenueWindow = {
  value: number;
  target: number;
  pct: number; // 0..1+
  paceDelta: number; // + ahead, - behind
  needPerPeriod: number; // $/month for YTD, $/day for MTD
  verdict: "ahead" | "on-pace" | "behind";
  verdictLabel: string;
  series: TrendPoint[]; // cumulative collected revenue over the window
};

export type SourceSlice = { source: string; revenue: number; count: number };

export type LeadsWindow = { count: number; sold: number; conversionPct: number };
export type NewClientsWindow = { count: number };
export type ProjectsWindow = { active: number; completed: number };

export type FirmPulse = {
  revenue: { ytd: RevenueWindow; mtd: RevenueWindow };
  booked: { ytd: { value: number; count: number }; mtd: { value: number; count: number } };
  pipeline: { value: number; count: number; stalledValue: number; stalledCount: number };
  mrr: { value: number; target: number; pct: number; subs: number };
  active: { value: number; count: number; unpaid: number };
  ar: { value: number; count: number; overdue: number };
  // sold = Project In Progress + Paid; paid = Paid only. Both over sent (incl. lost).
  conversion: {
    ytd: { soldPct: number; paidPct: number; sold: number; paid: number; sent: number };
    mtd: { soldPct: number; paidPct: number; sold: number; paid: number; sent: number };
  };
  // Display-only extras (no Airtable schema changes). Windowed for the toggle.
  leads: { ytd: LeadsWindow; mtd: LeadsWindow };
  newClients: { ytd: NewClientsWindow; mtd: NewClientsWindow };
  // `active` is a snapshot (same in both windows); `completed` is window-scoped.
  projects: { ytd: ProjectsWindow; mtd: ProjectsWindow };
  revenueBySource: { ytd: SourceSlice[]; mtd: SourceSlice[] };
};

function buildRevenueWindow(
  value: number,
  target: number,
  windowName: "ytd" | "mtd",
  series: TrendPoint[],
): RevenueWindow {
  const now = new Date();
  let elapsed: number;
  let total: number;
  let perPeriodLabel: (n: number) => string;
  if (windowName === "ytd") {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    total = 365;
    elapsed = Math.floor((now.getTime() - yearStart.getTime()) / 86_400_000);
  } else {
    total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    elapsed = now.getDate();
  }
  const requiredByNow = target * (elapsed / total);
  const paceDelta = value - requiredByNow;
  const remaining = Math.max(0.1, total - elapsed);
  const needPerPeriod =
    windowName === "ytd"
      ? Math.max(0, (target - value) / (remaining / 30.44))
      : Math.max(0, (target - value) / remaining);
  perPeriodLabel = windowName === "ytd" ? (n) => `${fmt(n)}/mo` : (n) => `${fmt(n)}/day`;
  const verdict: "ahead" | "on-pace" | "behind" =
    paceDelta >= 0 ? "ahead" : paceDelta > -target * 0.05 ? "on-pace" : "behind";
  const verdictLabel =
    verdict === "ahead"
      ? `Ahead of pace by ${fmt(paceDelta)}`
      : verdict === "on-pace"
        ? `On pace · ${perPeriodLabel(needPerPeriod)} to hit target`
        : `Behind pace by ${fmt(-paceDelta)} · need ${perPeriodLabel(needPerPeriod)}`;

  return {
    value,
    target,
    pct: target > 0 ? value / target : 0,
    paceDelta,
    needPerPeriod,
    verdict,
    verdictLabel,
    series,
  };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Fetch paid invoices for the current year and build cumulative YTD (monthly)
 *  + MTD (daily) series. One Airtable read, shared with /money via cache tag. */
async function buildRevenueSeries(): Promise<{ ytd: TrendPoint[]; mtd: TrendPoint[] }> {
  const now = new Date();
  const yearStartISO = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const t = Tables.Invoices;
  const records = await listRecordsCached<{ "Invoice Amount"?: number; Date?: string }>(
    t.id,
    {
      filterByFormula: `AND({Invoice Status} = 'paid', IS_AFTER({Date}, '${yearStartISO}'))`,
      fields: [t.fields["Invoice Amount"].id, t.fields["Date"].id],
    },
    ["kpi:revenue", "firm-pulse:revenue-series"],
  );

  const monthTotals = new Array(12).fill(0) as number[];
  const currentMonth = now.getMonth();
  const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();
  const dayTotals = new Array(daysInMonth).fill(0) as number[];

  for (const r of records) {
    const amt = r.fields["Invoice Amount"] ?? 0;
    const iso = r.fields.Date;
    if (!iso) continue;
    const d = new Date(iso);
    if (isNaN(d.getTime()) || d.getFullYear() !== now.getFullYear()) continue;
    monthTotals[d.getMonth()] += amt;
    if (d.getMonth() === currentMonth) {
      const dayIdx = d.getDate() - 1;
      if (dayIdx >= 0 && dayIdx < dayTotals.length) dayTotals[dayIdx] += amt;
    }
  }

  const ytd: TrendPoint[] = [];
  let runY = 0;
  for (let m = 0; m <= currentMonth; m++) {
    runY += monthTotals[m];
    ytd.push({ label: MONTH_LABELS[m], value: runY });
  }

  const mtd: TrendPoint[] = [];
  let runM = 0;
  const today = now.getDate();
  for (let d = 0; d < today; d++) {
    runM += dayTotals[d];
    mtd.push({ label: String(d + 1), value: runM });
  }

  return { ytd, mtd };
}

export async function getFirmPulse(): Promise<FirmPulse> {
  const [revYtd, revMtd, mrrRes, ar, quotes, series, leads, invoices] = await Promise.all([
    revenueYtd(),
    revenueMtd(),
    mrr(),
    openReceivables(),
    listAllQuotes(),
    buildRevenueSeries(),
    listAllLeads().catch(() => []),
    listAllInvoices().catch(() => []),
  ]);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  let bookedYtd = 0, bookedYtdCount = 0;
  let bookedMtd = 0, bookedMtdCount = 0;
  let openDollars = 0, openCount = 0, stalledDollars = 0, stalledCount = 0;
  let activeDollars = 0, activeCount = 0, activeUnpaid = 0;
  let sentYtd = 0, soldYtd = 0, paidQYtd = 0;
  let sentMtd = 0, soldMtd = 0, paidQMtd = 0;

  for (const q of quotes) {
    const days = daysSince(q.preparedDate);
    const inYtd = !!(q.preparedDate && q.preparedDate >= yearStart);
    const inMtd = !!(q.preparedDate && q.preparedDate >= monthStart);
    const isOpen = q.status ? OPEN_STATUSES.includes(q.status) : false;
    const isActive = q.status ? ACTIVE_STATUSES.includes(q.status) : false;
    const isPaid = q.status === "Paid";
    const isSold = q.status ? SOLD_STATUSES.includes(q.status) : false;
    const isWon = isActive || isPaid;
    const isLost = q.status === "Cancelled" || q.status === "Rejected";
    // "Sent" = quote left Draft (includes lost)
    const isSent =
      q.status === "Sent. Awaiting Approval." || isWon || isLost;

    if (isOpen) {
      openDollars += q.totalCost;
      openCount += 1;
      if (days > 14) {
        stalledDollars += q.totalCost;
        stalledCount += 1;
      }
    }
    if (isActive) {
      activeDollars += q.totalCost;
      activeCount += 1;
      activeUnpaid += q.amountOwed;
    }
    if (isWon && inYtd) {
      bookedYtd += q.totalCost;
      bookedYtdCount += 1;
    }
    if (isWon && inMtd) {
      bookedMtd += q.totalCost;
      bookedMtdCount += 1;
    }
    if (isSent && inYtd) {
      sentYtd += 1;
      if (isSold) soldYtd += 1;
      if (isPaid) paidQYtd += 1;
    }
    if (isSent && inMtd) {
      sentMtd += 1;
      if (isSold) soldMtd += 1;
      if (isPaid) paidQMtd += 1;
    }
  }

  // ── Leads: YTD + MTD + conversion ─────────────────────────
  let leadsYtdCount = 0, leadsYtdSold = 0;
  let leadsMtdCount = 0, leadsMtdSold = 0;
  for (const l of leads) {
    if (!l.createdTime) continue;
    const d = l.createdTime.slice(0, 10);
    if (d >= yearStart) {
      leadsYtdCount += 1;
      if (l.status === "Sold") leadsYtdSold += 1;
    }
    if (d >= monthStart) {
      leadsMtdCount += 1;
      if (l.status === "Sold") leadsMtdSold += 1;
    }
  }

  // ── Projects (from Quote.projectStatus) ───────────────────
  // `active` is a snapshot — same in either window. `completed` is windowed.
  const PROJECT_ACTIVE = new Set([
    "Proposal Signed",
    "Commencement Invoice Paid",
    "First Draft Delivered",
    "Project Accepted",
  ]);
  let projectsActive = 0;
  let projectsCompletedYtd = 0;
  let projectsCompletedMtd = 0;
  for (const q of quotes) {
    const ps = q.projectStatus;
    if (!ps) continue;
    if (PROJECT_ACTIVE.has(ps)) projectsActive += 1;
    if (ps === "Completion Invoice Paid") {
      const ref = q.signedDate ?? q.preparedDate;
      if (ref && ref >= yearStart) projectsCompletedYtd += 1;
      if (ref && ref >= monthStart) projectsCompletedMtd += 1;
    }
  }

  // ── New clients (first paid invoice in window) ────────────
  const firstPaidByPayer = new Map<string, string>();
  for (const inv of invoices) {
    if (inv.status !== "paid") continue;
    const payer = inv.payerRecordId ?? inv.payer;
    if (!payer || !inv.date) continue;
    const prev = firstPaidByPayer.get(payer);
    if (!prev || inv.date < prev) firstPaidByPayer.set(payer, inv.date);
  }
  let newClientsYtd = 0, newClientsMtd = 0;
  for (const d of firstPaidByPayer.values()) {
    if (d >= yearStart) newClientsYtd += 1;
    if (d >= monthStart) newClientsMtd += 1;
  }

  // ── Revenue by invoice source, paid, per window ───────────
  const tallySource = (since: string): SourceSlice[] => {
    const totals = new Map<string, { revenue: number; count: number }>();
    for (const inv of invoices) {
      if (inv.status !== "paid" || !inv.date) continue;
      if (inv.date < since) continue;
      const key = inv.source ?? "Other";
      const cur = totals.get(key) ?? { revenue: 0, count: 0 };
      cur.revenue += inv.amount;
      cur.count += 1;
      totals.set(key, cur);
    }
    return Array.from(totals.entries())
      .map(([source, v]) => ({ source, revenue: v.revenue, count: v.count }))
      .sort((a, b) => b.revenue - a.revenue);
  };
  const revenueBySource = { ytd: tallySource(yearStart), mtd: tallySource(monthStart) };

  const annualTarget = revYtd.target ?? 500_000;
  const monthlyTarget = revMtd.target ?? annualTarget / 12;

  const mrrTarget = mrrRes.target ?? 41_700;
  const mrrValue = mrrRes.value ?? 0;
  const subMatch = mrrRes.note?.match(/^(\d+)/);
  const subs = subMatch ? parseInt(subMatch[1], 10) : 0;

  return {
    revenue: {
      ytd: buildRevenueWindow(revYtd.value ?? 0, annualTarget, "ytd", series.ytd),
      mtd: buildRevenueWindow(revMtd.value ?? 0, monthlyTarget, "mtd", series.mtd),
    },
    booked: {
      ytd: { value: bookedYtd, count: bookedYtdCount },
      mtd: { value: bookedMtd, count: bookedMtdCount },
    },
    pipeline: {
      value: openDollars,
      count: openCount,
      stalledValue: stalledDollars,
      stalledCount,
    },
    mrr: { value: mrrValue, target: mrrTarget, pct: mrrTarget > 0 ? mrrValue / mrrTarget : 0, subs },
    active: { value: activeDollars, count: activeCount, unpaid: activeUnpaid },
    ar: { value: ar.total, count: ar.count, overdue: ar.overdue },
    conversion: {
      ytd: {
        soldPct: sentYtd > 0 ? soldYtd / sentYtd : 0,
        paidPct: sentYtd > 0 ? paidQYtd / sentYtd : 0,
        sold: soldYtd,
        paid: paidQYtd,
        sent: sentYtd,
      },
      mtd: {
        soldPct: sentMtd > 0 ? soldMtd / sentMtd : 0,
        paidPct: sentMtd > 0 ? paidQMtd / sentMtd : 0,
        sold: soldMtd,
        paid: paidQMtd,
        sent: sentMtd,
      },
    },
    leadsYtd: { count: leadsYtdCount, sold: leadsYtdSold, conversionPct: leadConvPct },
    newClientsYtd: { count: newClientsYtd },
    projects: { active: projectsActive, completedYtd: projectsCompletedYtd },
    revenueBySource,
  };
}
