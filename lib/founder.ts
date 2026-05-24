// Per-founder profile (Retirement Number + Ownership Percentage from People).
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { getAppSession } from "./session";
import { resolvePersonByEmail } from "./people";

export type FounderProfile = {
  personId: string | null;
  name: string | null;
  retirementNumber: number | null;
  ownershipPercentage: number | null; // normalized to 0..1
};

export async function getFounderProfile(): Promise<FounderProfile> {
  const session = await getAppSession();
  const email = session?.user?.email ?? null;
  const person = await resolvePersonByEmail(email);
  if (!person) {
    return { personId: null, name: null, retirementNumber: null, ownershipPercentage: null };
  }

  const records = await listRecordsCached<{
    "Retirement Number"?: number;
    "Ownership Percentage"?: number;
  }>(
    Tables.People.id,
    {
      fields: ["Retirement Number", "Ownership Percentage"],
      filterByFormula: `RECORD_ID() = "${person.id}"`,
    },
    [`founder:profile:${person.id}`],
  );

  const f = records[0]?.fields ?? {};
  const retirement = typeof f["Retirement Number"] === "number" ? f["Retirement Number"]! : null;
  const rawOwn = typeof f["Ownership Percentage"] === "number" ? f["Ownership Percentage"]! : null;
  // Airtable percent fields return decimals (0.6); guard against whole-percent (60).
  const ownership = rawOwn === null ? null : rawOwn > 1 ? rawOwn / 100 : rawOwn;

  return {
    personId: person.id,
    name: person.fullName,
    retirementNumber: retirement,
    ownershipPercentage: ownership,
  };
}

export type FounderRevenueTrend = {
  // Closed-month paid revenue, oldest → newest, up to 6 entries.
  monthlyHistory: number[];
  // Mean month-over-month delta in $ across the history (can be negative).
  avgMonthlyGrowth: number;
  // Latest fully-closed month's paid revenue (0 if none).
  latestClosedMonth: number;
};

// Pulls the last 6 fully-closed months of paid invoice revenue and computes
// the average month-over-month growth. Used to predict months-to-goal on
// the Founder Dashboard hero.
export async function getFounderRevenueTrend(): Promise<FounderRevenueTrend> {
  const now = new Date();
  // Start of current month — anything before this is a "closed" month.
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Look back 6 closed months.
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const windowStartISO = windowStart.toISOString().slice(0, 10);

  const t = Tables.Invoices;
  const records = await listRecordsCached<{ "Invoice Amount"?: number; Date?: string }>(
    t.id,
    {
      filterByFormula: `AND({Invoice Status} = 'paid', IS_AFTER({Date}, '${windowStartISO}'))`,
      fields: [t.fields["Invoice Amount"].id, t.fields["Date"].id],
    },
    ["kpi:revenue", "founder:revenue-trend"],
  );

  // Bucket by YYYY-MM for the 6 closed months preceding currentMonthStart.
  const buckets = new Map<string, number>();
  for (let i = 6; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
  }

  for (const r of records) {
    const amt = r.fields["Invoice Amount"] ?? 0;
    const iso = r.fields.Date;
    if (!iso) continue;
    const d = new Date(iso);
    if (isNaN(d.getTime())) continue;
    if (d >= currentMonthStart) continue; // skip in-progress month
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + amt);
  }

  const monthlyHistory = Array.from(buckets.values());
  const latestClosedMonth = monthlyHistory.length ? monthlyHistory[monthlyHistory.length - 1] : 0;

  let avgMonthlyGrowth = 0;
  if (monthlyHistory.length >= 2) {
    const deltas: number[] = [];
    for (let i = 1; i < monthlyHistory.length; i++) {
      deltas.push(monthlyHistory[i] - monthlyHistory[i - 1]);
    }
    avgMonthlyGrowth = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  }

  return { monthlyHistory, avgMonthlyGrowth, latestClosedMonth };
}
