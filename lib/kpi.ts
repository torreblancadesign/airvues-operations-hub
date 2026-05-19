// KPI calculators. Each returns a uniform shape for the home-page tiles.
// Reads are cached for 5 minutes via lib/airtable.ts unstable_cache wrapper.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type KpiResult = {
  value: number | null;
  formatted: string;
  delta: number | null;
  deltaLabel?: string;
  target?: number;
  targetLabel?: string;
  asOf: Date;
  note?: string;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtPercent = (n: number, decimals = 0) =>
  `${(n * 100).toFixed(decimals)}%`;

/** YTD revenue: SUM(Invoice Amount) WHERE Status='paid' AND Date >= YEAR_START.
 *  Note: target is annual ($500K), so we also compute pace (% of year done vs %
 *  of target reached) and what's needed/month to catch up. */
export async function revenueYtd(): Promise<KpiResult> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearStartISO = yearStart.toISOString().slice(0, 10);
  const t = Tables.Invoices;
  const records = await listRecordsCached<{ "Invoice Amount"?: number; "Invoice Status"?: string; Date?: string }>(
    t.id,
    {
      filterByFormula: `AND({Invoice Status} = 'paid', IS_AFTER({Date}, '${yearStartISO}'))`,
      fields: [t.fields["Invoice Amount"].id, t.fields["Invoice Status"].id, t.fields["Date"].id],
      returnFieldsByFieldId: false,
    },
    ["kpi:revenue"],
  );
  const total = records.reduce((sum, r) => sum + (r.fields["Invoice Amount"] || 0), 0);
  const target = 500_000;

  // Pace calculation
  const daysInYear = 365;
  const daysIntoYear = Math.floor((now.getTime() - yearStart.getTime()) / 86_400_000);
  const requiredByNow = target * (daysIntoYear / daysInYear);
  const aheadOrBehind = total - requiredByNow;
  const remainingDays = daysInYear - daysIntoYear;
  const remainingMonths = remainingDays / 30.44;
  const needPerMonth = remainingMonths > 0 ? (target - total) / remainingMonths : 0;

  const pacingNote =
    aheadOrBehind >= 0
      ? `Ahead of pace by ${fmtCurrency(aheadOrBehind)}`
      : `Behind pace by ${fmtCurrency(-aheadOrBehind)} · need ${fmtCurrency(needPerMonth)}/mo`;

  return {
    value: total,
    formatted: fmtCurrency(total),
    delta: null,
    target,
    targetLabel: `${Math.round((total / target) * 100)}% of ${fmtCurrency(target)}`,
    asOf: now,
    note: pacingNote,
  };
}

/** MRR: SUM(Invoice Amount) WHERE Type='Recurring' AND Status='paid' AND Date in current month */
/** MRR: sum of Invoice Amount across active recurring subscriptions.
 *  Source: Invoices where Invoice Type = 'Recurring' AND Invoice Status = 'subscribed'.
 *  Each 'subscribed' record represents one active subscription template (one client
 *  paying monthly), so summing Invoice Amount gives the monthly recurring run-rate.
 *  Mirrors the filter used in onRetainerPct() so the two KPIs stay consistent. */
export async function mrr(): Promise<KpiResult> {
  const t = Tables.Invoices;
  const records = await listRecordsCached<{ "Invoice Amount"?: number }>(
    t.id,
    {
      filterByFormula: `AND({Invoice Type} = 'Recurring', {Invoice Status} = 'subscribed')`,
      fields: [t.fields["Invoice Amount"].id],
    },
    ["kpi:mrr"],
  );
  const total = records.reduce((sum, r) => sum + (r.fields["Invoice Amount"] || 0), 0);
  const target = 41_700;
  const subCount = records.length;
  return {
    value: total,
    formatted: fmtCurrency(total),
    delta: null,
    target,
    targetLabel: `Target ${fmtCurrency(target)} · ${Math.round((total / target) * 100)}%`,
    asOf: new Date(),
    note: `${subCount} active recurring subscription${subCount === 1 ? "" : "s"}`,
  };
}

/** On retainer %: count distinct payers with an active subscribed Recurring invoice,
 *  divided by count of Active companies. Uses Invoices.Recurring as the source of truth
 *  (Companies.Contract Type=Membership was the legacy field but is never populated). */
export async function onRetainerPct(): Promise<KpiResult> {
  const iT = Tables.Invoices;
  const cT = Tables.Companies;

  const [recurringInvoices, allCompanies] = await Promise.all([
    listRecordsCached<{ "Invoice Status"?: string; "Invoice Payer"?: string[] }>(
      iT.id,
      {
        filterByFormula: `AND({Invoice Type} = 'Recurring', {Invoice Status} = 'subscribed')`,
        fields: [
          iT.fields["Invoice Status"].id,
          iT.fields["Invoice Payer"].id,
          iT.fields["Invoice Type"].id,
        ],
      },
      ["kpi:retainer-invoices"],
    ),
    listRecordsCached<{ "Engagement Frequency"?: string }>(
      cT.id,
      { fields: [cT.fields["Engagement Frequency"].id] },
      ["kpi:retainer-companies"],
    ),
  ]);

  // Count distinct Payers across active Recurring subscriptions
  const distinctPayers = new Set<string>();
  for (const inv of recurringInvoices) {
    const payers = (inv.fields["Invoice Payer"] as string[] | undefined) ?? [];
    for (const p of payers) distinctPayers.add(p);
  }
  const onRetainerCount = distinctPayers.size;
  const activeCount = allCompanies.filter((r) => r.fields["Engagement Frequency"] === "Active").length;
  const ratio = activeCount === 0 ? 0 : onRetainerCount / activeCount;
  const target = 0.5;
  return {
    value: ratio,
    formatted: fmtPercent(ratio),
    delta: null,
    target,
    targetLabel: `Target ${fmtPercent(target)}`,
    asOf: new Date(),
    note: `${onRetainerCount} of ${activeCount} active clients on retainer`,
  };
}

/** Raw company goals data — YTD revenue $, distinct retainer count, active company count.
 *  Reuses the same Airtable reads as revenueYtd + onRetainerPct via unstable_cache dedupe. */
export async function companyGoalsData(): Promise<{
  ytdRevenue: number;
  retainerCount: number;
  activeClients: number;
}> {
  const [revenue, retainer] = await Promise.all([revenueYtd(), onRetainerPct()]);
  // onRetainerPct note format: "X of Y active clients on retainer"
  const m = retainer.note?.match(/^(\d+) of (\d+)/);
  const retainerCount = m ? parseInt(m[1], 10) : 0;
  const activeClients = m ? parseInt(m[2], 10) : 0;
  return {
    ytdRevenue: revenue.value ?? 0,
    retainerCount,
    activeClients,
  };
}

/** Sprint delivery: AVG over last 4 done sprints of (completed stories / total stories in sprint) */
export async function sprintDelivery(): Promise<KpiResult> {
  const sprintsT = Tables.Sprints;
  const storiesT = Tables.Stories;

  const doneSprints = await listRecordsCached<{ "Sprint Status"?: string; "Sprint Number"?: number; Stories?: string[] }>(
    sprintsT.id,
    {
      filterByFormula: `{Sprint Status} = 'Done'`,
      fields: [sprintsT.fields["Sprint Status"].id, sprintsT.fields["Sprint Number"].id, sprintsT.fields["Stories"].id],
      sort: [{ field: "Sprint Number", direction: "desc" }],
      maxRecords: 4,
    },
    ["kpi:sprint-delivery"],
  );

  if (doneSprints.length === 0) {
    return {
      value: null,
      formatted: "—",
      delta: null,
      asOf: new Date(),
      note: "No completed sprints yet",
    };
  }

  // For each sprint, fetch its linked stories & status
  const ratios: number[] = [];
  let sprintsWithStories = 0;
  for (const sp of doneSprints) {
    const storyIds = sp.fields.Stories || [];
    if (storyIds.length === 0) continue; // skip — can't compute ratio for sprint with no Stories linked
    sprintsWithStories += 1;
    const filter = `OR(${storyIds.map((id) => `RECORD_ID() = '${id}'`).join(",")})`;
    const stories = await listRecordsCached<{ "Story Status"?: string }>(
      storiesT.id,
      {
        filterByFormula: filter,
        fields: [storiesT.fields["Story Status"].id],
      },
      ["kpi:sprint-delivery"],
    );
    const done = stories.filter((s) => s.fields["Story Status"] === "Completed").length;
    ratios.push(stories.length === 0 ? 0 : done / stories.length);
  }

  // If we fetched done sprints but NONE of them have Stories linked, the metric is
  // not "0%" — it's "we can't compute it because Sprint→Stories link is broken."
  if (ratios.length === 0) {
    return {
      value: null,
      formatted: "—",
      delta: null,
      asOf: new Date(),
      note: `${doneSprints.length} done sprints in base · 0 have Stories linked — data hygiene issue`,
    };
  }

  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const target = 0.9;
  const incomplete = doneSprints.length - sprintsWithStories;
  return {
    value: avg,
    formatted: fmtPercent(avg),
    delta: null,
    target,
    targetLabel: `Target ${fmtPercent(target)}`,
    asOf: new Date(),
    note:
      incomplete > 0
        ? `Last ${ratios.length} done sprints · ${incomplete} sprint${incomplete === 1 ? "" : "s"} skipped (no Story links)`
        : `Last ${ratios.length} done sprints`,
  };
}

/** Open receivables — sum of outstanding invoices */
export async function openReceivables(): Promise<{ total: number; count: number; overdue: number }> {
  const t = Tables.Invoices;
  const records = await listRecordsCached<{ "Invoice Amount"?: number; "Invoice Status"?: string; Date?: string }>(
    t.id,
    {
      filterByFormula: `OR({Invoice Status} = 'open', {Invoice Status} = 'sent', {Invoice Status} = 'past due', {Invoice Status} = 'unsent')`,
      fields: [t.fields["Invoice Amount"].id, t.fields["Invoice Status"].id, t.fields["Date"].id],
    },
    ["kpi:receivables"],
  );
  const total = records.reduce((sum, r) => sum + (r.fields["Invoice Amount"] || 0), 0);
  const overdue = records.filter((r) => r.fields["Invoice Status"] === "past due").length;
  return { total, count: records.length, overdue };
}

// ============================================================================
// Money page — additional reads
// ============================================================================

export type ArAgingBuckets = {
  buckets: { label: string; count: number; total: number }[];
  grandTotal: number;
  grandCount: number;
};

/** AR Aging — outstanding invoices bucketed by days since invoice Date (issue date).
 *  Previously bucketed by Invoice Status Last Modified, which under-reports aging
 *  for invoices created at one status and never re-touched. */
export async function arAging(): Promise<ArAgingBuckets> {
  const t = Tables.Invoices;
  const records = await listRecordsCached<{
    "Invoice Amount"?: number;
    "Invoice Status"?: string;
    Date?: string;
  }>(
    t.id,
    {
      filterByFormula: `OR({Invoice Status} = 'open', {Invoice Status} = 'sent', {Invoice Status} = 'past due', {Invoice Status} = 'unsent')`,
      fields: [
        t.fields["Invoice Amount"].id,
        t.fields["Invoice Status"].id,
        t.fields["Date"].id,
      ],
    },
    ["kpi:ar-aging"],
  );
  const now = Date.now();
  const ranges: { label: string; min: number; max: number }[] = [
    { label: "0–30 days", min: 0, max: 30 },
    { label: "30–60 days", min: 30, max: 60 },
    { label: "60–90 days", min: 60, max: 90 },
    { label: "90+ days", min: 90, max: Infinity },
  ];
  const buckets = ranges.map((r) => ({ label: r.label, count: 0, total: 0 }));
  let grandTotal = 0;
  let grandCount = 0;
  for (const rec of records) {
    const amt = rec.fields["Invoice Amount"] || 0;
    const date = rec.fields["Date"];
    if (!date) continue;
    const days = Math.floor((now - new Date(date).getTime()) / 86_400_000);
    const idx = ranges.findIndex((r) => days >= r.min && days < r.max);
    if (idx === -1) continue;
    buckets[idx].count += 1;
    buckets[idx].total += amt;
    grandTotal += amt;
    grandCount += 1;
  }
  return { buckets, grandTotal, grandCount };
}

export type TopClient = { name: string; email: string; total: number; count: number; isOrphan?: boolean };

/** Top revenue clients — sum of paid invoices grouped by Invoice Payer.
 *  Invoices with NO Invoice Payer link (legacy Fiverr-era orphans) are grouped
 *  into a single "(no payer · legacy)" bucket so the totals reconcile to lifetime revenue. */
export async function topRevenueClients(limit = 10): Promise<TopClient[]> {
  const t = Tables.Invoices;
  const records = await listRecordsCached<{
    "Invoice Amount"?: number;
    "Invoice Status"?: string;
    "Invoice Payer"?: string[];
  }>(
    t.id,
    {
      filterByFormula: `{Invoice Status} = 'paid'`,
      fields: [
        t.fields["Invoice Amount"].id,
        t.fields["Invoice Status"].id,
        t.fields["Invoice Payer"].id,
        t.fields["Invoice Identifier"].id,
      ],
    },
    ["kpi:top-clients"],
  );

  const byPayer = new Map<string, TopClient>();
  const ORPHAN_KEY = "(no payer · legacy)";

  for (const rec of records) {
    const f = rec.fields as Record<string, unknown>;
    const payerLinks = (f["Invoice Payer"] as string[] | undefined) ?? [];
    const identifier = (f["Invoice Identifier"] as string | undefined) ?? "";
    const amt = (f["Invoice Amount"] as number | undefined) || 0;

    let key: string;
    let isOrphan = false;
    if (payerLinks.length === 0) {
      key = ORPHAN_KEY;
      isOrphan = true;
    } else {
      // Extract payer name from Invoice Identifier formula: `{ID}-{Payer Name} | ${Amount}`
      const match = identifier.match(/^\d+-([^|]+?)\s*\|/);
      key = (match ? match[1].trim() : "(unnamed payer)") || "(unnamed payer)";
    }

    const existing = byPayer.get(key);
    if (existing) {
      existing.total += amt;
      existing.count += 1;
    } else {
      byPayer.set(key, { name: key, email: "", total: amt, count: 1, isOrphan });
    }
  }
  return Array.from(byPayer.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export type RecurringPayer = {
  id: string;
  payer: string;
  amount: number;
  status: string;
  date: string | null;
};

/** Active recurring contracts — the actual MRR breakdown by payer. */
export async function mrrBreakdown(): Promise<RecurringPayer[]> {
  const t = Tables.Invoices;
  const records = await listRecordsCached<{
    "Invoice Amount"?: number;
    "Invoice Status"?: string;
    "Invoice Identifier"?: string;
    "Date"?: string;
  }>(
    t.id,
    {
      filterByFormula: `AND({Invoice Type} = 'Recurring', OR({Invoice Status} = 'subscribed', {Invoice Status} = 'send subscription link', {Invoice Status} = 'paid'))`,
      fields: [
        t.fields["Invoice Amount"].id,
        t.fields["Invoice Status"].id,
        t.fields["Invoice Identifier"].id,
        t.fields["Date"].id,
        t.fields["Invoice Type"].id,
      ],
    },
    ["kpi:mrr-breakdown"],
  );
  return records
    .map((r) => {
      const identifier = (r.fields["Invoice Identifier"] as string | undefined) ?? "";
      const match = identifier.match(/^\d+-([^|]+?)\s*\|/);
      return {
        id: r.id,
        payer: (match ? match[1].trim() : "(unknown)") || "(unknown)",
        amount: (r.fields["Invoice Amount"] as number | undefined) || 0,
        status: (r.fields["Invoice Status"] as string | undefined) || "",
        date: (r.fields["Date"] as string | undefined) || null,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Average paid invoice size (lifetime). */
export async function avgInvoice(): Promise<KpiResult> {
  const t = Tables.Invoices;
  const records = await listRecordsCached<{ "Invoice Amount"?: number }>(
    t.id,
    {
      filterByFormula: `{Invoice Status} = 'paid'`,
      fields: [t.fields["Invoice Amount"].id, t.fields["Invoice Status"].id],
    },
    ["kpi:avg-invoice"],
  );
  if (records.length === 0) {
    return { value: null, formatted: "—", delta: null, asOf: new Date() };
  }
  const sum = records.reduce((s, r) => s + (r.fields["Invoice Amount"] || 0), 0);
  const avg = sum / records.length;
  return {
    value: avg,
    formatted: fmtCurrency(avg),
    delta: null,
    asOf: new Date(),
    note: `Across ${records.length.toLocaleString()} paid invoices`,
  };
}
