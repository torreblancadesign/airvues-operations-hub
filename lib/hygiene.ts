// Hygiene index — single read that surfaces all data-quality blockers.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { getEngineeringBoard } from "./engineering";

export type HygieneIndex = {
  orphanStories: { count: number; invoice: number; hours: number };
  unroutedPayments: { count: number; amount: number; agingDays: number };
  misclassifiedCompanies: { count: number; revenue: number };
  emptyTimeEntries: { count: number };
  staleQuotes: { count: number; value: number };
  asOf: string;
};

export async function getHygieneIndex(): Promise<HygieneIndex> {
  const [board, payments, companies, timeEntries, quotes, invoices] = await Promise.all([
    getEngineeringBoard(),
    listRecordsCached<{
      Amount?: number;
      Status?: string;
      Payee?: { email?: string };
      Date?: string;
    }>(
      Tables.TeamTaskPayments.id,
      {
        fields: [
          Tables.TeamTaskPayments.fields["Amount"].id,
          Tables.TeamTaskPayments.fields["Status"].id,
          Tables.TeamTaskPayments.fields["Payee"].id,
          Tables.TeamTaskPayments.fields["Date"].id,
        ],
      },
      ["hygiene:payments"],
    ),
    listRecordsCached<{ "Engagement Frequency"?: string }>(
      Tables.Companies.id,
      {
        fields: [Tables.Companies.fields["Engagement Frequency"].id],
      },
      ["hygiene:companies"],
    ),
    listRecordsCached<Record<string, unknown>>(
      Tables.TimeEntries.id,
      { fields: [Tables.TimeEntries.fields["Hours"].id], maxRecords: 1 },
      ["hygiene:time-entries"],
    ),
    listRecordsCached<{ Status?: string; "Total Project Cost"?: number; "Prepared Date"?: string }>(
      Tables.Quotes.id,
      {
        fields: [
          Tables.Quotes.fields["Status"].id,
          Tables.Quotes.fields["Total Project Cost"].id,
          Tables.Quotes.fields["Prepared Date"].id,
        ],
      },
      ["hygiene:quotes"],
    ),
    Promise.resolve([]), // placeholder if needed
  ]);

  // Orphan stories
  const orphanGroup = board.groups.find((g) => g.isOrphan);
  const orphans = orphanGroup?.stories ?? [];
  let orphanInvoice = 0;
  let orphanHours = 0;
  for (const s of orphans) {
    orphanInvoice += s.invoice;
    orphanHours += s.hours ?? 0;
  }

  // Unrouted payments: Status=Needs Payment + Payee is placeholder
  let unroutedCount = 0;
  let unroutedAmount = 0;
  let oldestUnroutedDays = 0;
  const now = Date.now();
  for (const p of payments) {
    const status = p.fields.Status;
    if (status !== "Needs Payment") continue;
    const payeeEmail =
      typeof p.fields.Payee === "object" && p.fields.Payee !== null
        ? (p.fields.Payee as { email?: string }).email
        : undefined;
    // Heuristic: placeholder is support@airvues.com OR null/missing
    const isPlaceholder = !payeeEmail || payeeEmail === "support@airvues.com";
    if (!isPlaceholder) continue;
    unroutedCount++;
    unroutedAmount += p.fields.Amount ?? 0;
    if (p.fields.Date) {
      const days = Math.floor((now - new Date(p.fields.Date).getTime()) / 86_400_000);
      if (days > oldestUnroutedDays) oldestUnroutedDays = days;
    }
  }

  // Misclassified companies: still "New" with engagement gap (would need a separate read of invoices linked to people linked to company; skip for now — script handles this)
  // Here, just report the COUNT of companies still in "New" status (so we can show "still need triage" if any)
  const stillNew = companies.filter((c) => c.fields["Engagement Frequency"] === "New").length;

  // Empty Time Entries
  const timeEntriesCount = timeEntries.length;

  // Stale quotes (Awaiting Approval > 14 days)
  let staleQuoteCount = 0;
  let staleQuoteValue = 0;
  for (const q of quotes) {
    const status = q.fields.Status;
    if (status !== "Sent. Awaiting Approval." && status !== "Awaiting Payment") continue;
    const prep = q.fields["Prepared Date"];
    if (!prep) continue;
    const days = Math.floor((now - new Date(prep).getTime()) / 86_400_000);
    if (days < 14) continue;
    staleQuoteCount++;
    staleQuoteValue += q.fields["Total Project Cost"] ?? 0;
  }

  void invoices;

  return {
    orphanStories: {
      count: orphans.length,
      invoice: orphanInvoice,
      hours: orphanHours,
    },
    unroutedPayments: {
      count: unroutedCount,
      amount: unroutedAmount,
      agingDays: oldestUnroutedDays,
    },
    misclassifiedCompanies: {
      count: stillNew,
      revenue: 0, // accurate count requires the script join; this is the "still New" total
    },
    emptyTimeEntries: { count: timeEntriesCount },
    staleQuotes: { count: staleQuoteCount, value: staleQuoteValue },
    asOf: new Date().toISOString(),
  };
}
