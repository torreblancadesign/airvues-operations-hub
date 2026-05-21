// Aggregated home-page hero: pulls together the most important firm-wide
// numbers from Earnings (Invoices) and Pipeline (Quotes) in one cached call.
import "server-only";

import { revenueYtd, mrr, openReceivables } from "./kpi";
import { listAllQuotes } from "./pipeline";

const OPEN_STATUSES = ["Draft", "Sent. Awaiting Approval.", "Auditing 🚩"];
const ACTIVE_STATUSES = ["Approved and Signed", "Awaiting Payment", "Project In Progress"];

const daysSince = (iso: string | null): number => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
};

export type FirmPulse = {
  revenue: {
    value: number;
    target: number;
    pct: number; // 0..1+
    paceDelta: number; // + ahead, - behind
    needPerMonth: number;
    verdict: "ahead" | "on-pace" | "behind";
    verdictLabel: string;
  };
  booked: { value: number; count: number };
  pipeline: { value: number; count: number; stalledValue: number; stalledCount: number };
  mrr: { value: number; target: number; pct: number; subs: number };
  active: { value: number; count: number; unpaid: number };
  ar: { value: number; count: number; overdue: number };
  conversion: { pct: number; paid: number; sent: number };
};

export async function getFirmPulse(): Promise<FirmPulse> {
  const [rev, mrrRes, ar, quotes] = await Promise.all([
    revenueYtd(),
    mrr(),
    openReceivables(),
    listAllQuotes(),
  ]);

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  let bookedYtd = 0, bookedYtdCount = 0;
  let openDollars = 0, openCount = 0, stalledDollars = 0, stalledCount = 0;
  let activeDollars = 0, activeCount = 0, activeUnpaid = 0;
  let sentCount = 0, paidCount = 0;

  for (const q of quotes) {
    const days = daysSince(q.preparedDate);
    const isYtd = q.preparedDate && q.preparedDate >= yearStart;
    const isOpen = q.status ? OPEN_STATUSES.includes(q.status) : false;
    const isActive = q.status ? ACTIVE_STATUSES.includes(q.status) : false;
    const isPaid = q.status === "Paid";
    const isWon = isActive || isPaid;

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
    if (isWon && isYtd) {
      bookedYtd += q.totalCost;
      bookedYtdCount += 1;
    }
    if (
      q.status === "Sent. Awaiting Approval." ||
      q.status === "Approved and Signed" ||
      q.status === "Awaiting Payment" ||
      q.status === "Project In Progress" ||
      q.status === "Paid"
    ) {
      sentCount += 1;
    }
    if (isPaid) paidCount += 1;
  }

  // Pace math (mirrors revenueYtd internals)
  const now = new Date();
  const yearStartDate = new Date(now.getFullYear(), 0, 1);
  const daysInYear = 365;
  const daysIntoYear = Math.floor((now.getTime() - yearStartDate.getTime()) / 86_400_000);
  const target = rev.target ?? 500_000;
  const value = rev.value ?? 0;
  const requiredByNow = target * (daysIntoYear / daysInYear);
  const paceDelta = value - requiredByNow;
  const remainingMonths = Math.max(0.1, (daysInYear - daysIntoYear) / 30.44);
  const needPerMonth = Math.max(0, (target - value) / remainingMonths);
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const verdict: "ahead" | "on-pace" | "behind" =
    paceDelta >= 0 ? "ahead" : paceDelta > -target * 0.05 ? "on-pace" : "behind";
  const verdictLabel =
    verdict === "ahead"
      ? `Ahead of pace by ${fmt(paceDelta)}`
      : verdict === "on-pace"
        ? `On pace · ${fmt(needPerMonth)}/mo to hit target`
        : `Behind pace by ${fmt(-paceDelta)} · need ${fmt(needPerMonth)}/mo`;

  const mrrTarget = mrrRes.target ?? 41_700;
  const mrrValue = mrrRes.value ?? 0;
  const subMatch = mrrRes.note?.match(/^(\d+)/);
  const subs = subMatch ? parseInt(subMatch[1], 10) : 0;

  return {
    revenue: {
      value,
      target,
      pct: target > 0 ? value / target : 0,
      paceDelta,
      needPerMonth,
      verdict,
      verdictLabel,
    },
    booked: { value: bookedYtd, count: bookedYtdCount },
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
      pct: sentCount > 0 ? paidCount / sentCount : 0,
      paid: paidCount,
      sent: sentCount,
    },
  };
}
