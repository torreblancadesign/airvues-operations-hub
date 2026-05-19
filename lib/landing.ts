// Home-page aggregator: "Departures" (things leaving / overdue / closing soon)
// + "Arrivals" (recent activity). Server-only — uses the same cached Airtable reads.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { getEngineeringBoard } from "./engineering";
import { listSprints } from "./sprints";

export type Urgency = "red" | "amber" | "emerald" | "sky" | "violet" | "neutral";

export type BoardItem = {
  id: string;
  kind: "quote" | "invoice" | "sprint" | "story" | "company" | "deploy";
  label: string;
  sub: string;
  href: string;
  badge: string;
  urgency: Urgency;
  amount?: number;
  ageDays?: number;
};

export type LandingBoards = {
  departures: BoardItem[];
  arrivals: BoardItem[];
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const daysAgo = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
};

const daysAhead = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
};

export async function getLandingBoards(): Promise<LandingBoards> {
  const baseUrl = process.env.AIRTABLE_BASE_ID
    ? `https://airtable.com/${process.env.AIRTABLE_BASE_ID}`
    : "https://airtable.com";

  const [quotes, invoices, sprints, board] = await Promise.all([
    listRecordsCached<{
      "Quote ID"?: string;
      "Project Name"?: string;
      "Company Name"?: string[];
      "Client Name"?: string[];
      Status?: string;
      "Total Project Cost"?: number;
      "Prepared Date"?: string;
      Created?: string;
    }>(
      Tables.Quotes.id,
      {
        fields: [
          Tables.Quotes.fields["Quote ID"].id,
          Tables.Quotes.fields["Project Name"].id,
          Tables.Quotes.fields["Company Name"].id,
          Tables.Quotes.fields["Client Name"].id,
          Tables.Quotes.fields["Status"].id,
          Tables.Quotes.fields["Total Project Cost"].id,
          Tables.Quotes.fields["Prepared Date"].id,
          Tables.Quotes.fields["Created"].id,
        ],
      },
      ["landing:quotes"],
    ),
    listRecordsCached<{
      "Invoice ID"?: number;
      "Invoice Identifier"?: string;
      "Invoice Amount"?: number;
      "Invoice Status"?: string;
      Date?: string;
      Created?: string;
    }>(
      Tables.Invoices.id,
      {
        fields: [
          Tables.Invoices.fields["Invoice ID"].id,
          Tables.Invoices.fields["Invoice Identifier"].id,
          Tables.Invoices.fields["Invoice Amount"].id,
          Tables.Invoices.fields["Invoice Status"].id,
          Tables.Invoices.fields["Date"].id,
          Tables.Invoices.fields["Created"].id,
        ],
      },
      ["landing:invoices"],
    ),
    listSprints(),
    getEngineeringBoard(),
  ]);

  // ── Departures ─────────────────────────────────────────────────
  const departures: BoardItem[] = [];

  // Stale quotes — Awaiting Approval / Payment > 14 days
  for (const q of quotes) {
    const status = q.fields.Status;
    if (status !== "Sent. Awaiting Approval." && status !== "Awaiting Payment") continue;
    const age = daysAgo(q.fields["Prepared Date"]);
    if (age == null || age < 14) continue;
    const company =
      (q.fields["Company Name"] as string[] | undefined)?.[0] ??
      (q.fields["Client Name"] as string[] | undefined)?.[0] ??
      "(no client)";
    const project = (q.fields["Project Name"] as string) ?? "Quote";
    departures.push({
      id: `quote-${q.id}`,
      kind: "quote",
      label: project,
      sub: `${company} · ${age}d in ${status === "Awaiting Payment" ? "payment" : "approval"}`,
      href: `${baseUrl}/${Tables.Quotes.id}/${q.id}`,
      badge: fmtMoney(q.fields["Total Project Cost"] ?? 0),
      urgency: age > 30 ? "red" : "amber",
      amount: q.fields["Total Project Cost"] ?? 0,
      ageDays: age,
    });
  }

  // Past-due invoices — open / sent / unsent / past due, > 30 days old
  for (const inv of invoices) {
    const status = inv.fields["Invoice Status"];
    if (!status || !["open", "sent", "unsent", "past due"].includes(status)) continue;
    const age = daysAgo(inv.fields.Date);
    if (age == null || age < 30) continue;
    const identifier = inv.fields["Invoice Identifier"] ?? `Invoice #${inv.fields["Invoice ID"] ?? "?"}`;
    departures.push({
      id: `inv-${inv.id}`,
      kind: "invoice",
      label: identifier.split("|")[0]?.trim() || identifier,
      sub: `${status} · ${age}d`,
      href: `${baseUrl}/${Tables.Invoices.id}/${inv.id}`,
      badge: fmtMoney(inv.fields["Invoice Amount"] ?? 0),
      urgency: age > 90 ? "red" : "amber",
      amount: inv.fields["Invoice Amount"] ?? 0,
      ageDays: age,
    });
  }

  // Active sprints — show ones ending soon (≤ 5 days remaining)
  for (const s of sprints) {
    if (s.status !== "In Progress") continue;
    const remaining = daysAhead(s.end);
    if (remaining == null) continue;
    if (remaining > 5) continue;
    const sprintName = s.number != null ? `Sprint #${s.number}` : s.name;
    departures.push({
      id: `sprint-${s.id}`,
      kind: "sprint",
      label: sprintName,
      sub:
        remaining < 0
          ? `Ended ${Math.abs(remaining)}d ago · ${Math.round(s.completionPct)}% done`
          : remaining === 0
            ? `Ends today · ${Math.round(s.completionPct)}% done`
            : `Ends in ${remaining}d · ${Math.round(s.completionPct)}% done`,
      href: `/sprints/${s.id}`,
      badge: `${Math.round(s.completionPct)}%`,
      urgency: s.completionPct >= 80 ? "emerald" : s.completionPct >= 50 ? "amber" : "red",
      ageDays: remaining,
    });
  }

  // Sort departures: highest urgency first, then by amount/age
  const urgencyRank: Record<Urgency, number> = {
    red: 0, amber: 1, emerald: 2, sky: 3, violet: 4, neutral: 5,
  };
  departures.sort((a, b) => {
    if (urgencyRank[a.urgency] !== urgencyRank[b.urgency]) {
      return urgencyRank[a.urgency] - urgencyRank[b.urgency];
    }
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  // ── Arrivals ─────────────────────────────────────────────────────
  const arrivals: BoardItem[] = [];

  // Recent quotes (created last 14 days)
  for (const q of quotes) {
    const age = daysAgo(q.fields.Created);
    if (age == null || age > 14) continue;
    const company =
      (q.fields["Company Name"] as string[] | undefined)?.[0] ??
      (q.fields["Client Name"] as string[] | undefined)?.[0] ??
      "(no client)";
    const project = (q.fields["Project Name"] as string) ?? "Quote";
    arrivals.push({
      id: `arr-quote-${q.id}`,
      kind: "quote",
      label: `New quote · ${project}`,
      sub: `${company} · ${age === 0 ? "today" : `${age}d ago`}`,
      href: `${baseUrl}/${Tables.Quotes.id}/${q.id}`,
      badge: fmtMoney(q.fields["Total Project Cost"] ?? 0),
      urgency: "sky",
      amount: q.fields["Total Project Cost"] ?? 0,
      ageDays: age,
    });
  }

  // Recent invoices paid (Date in last 14 days, Status=paid)
  for (const inv of invoices) {
    if (inv.fields["Invoice Status"] !== "paid") continue;
    const age = daysAgo(inv.fields.Date);
    if (age == null || age > 14) continue;
    const identifier = inv.fields["Invoice Identifier"] ?? `Invoice #${inv.fields["Invoice ID"] ?? "?"}`;
    arrivals.push({
      id: `arr-inv-${inv.id}`,
      kind: "invoice",
      label: `Paid · ${identifier.split("|")[0]?.trim() || identifier}`,
      sub: age === 0 ? "today" : `${age}d ago`,
      href: `${baseUrl}/${Tables.Invoices.id}/${inv.id}`,
      badge: fmtMoney(inv.fields["Invoice Amount"] ?? 0),
      urgency: "emerald",
      amount: inv.fields["Invoice Amount"] ?? 0,
      ageDays: age,
    });
  }

  // Recently completed sprints (Status=Done, end date within 14 days)
  for (const s of sprints) {
    if (s.status !== "Done") continue;
    const age = daysAgo(s.end);
    if (age == null || age > 14 || age < 0) continue;
    const sprintName = s.number != null ? `Sprint #${s.number}` : s.name;
    arrivals.push({
      id: `arr-sprint-${s.id}`,
      kind: "sprint",
      label: `${sprintName} closed`,
      sub: `${age === 0 ? "today" : `${age}d ago`} · ${Math.round(s.completionPct)}% delivered`,
      href: `/sprints/${s.id}`,
      badge: `${Math.round(s.completionPct)}%`,
      urgency: s.completionPct >= 80 ? "emerald" : "amber",
      ageDays: age,
    });
  }

  // Top 5 most-recent stories created (assignee or orphan, last 7 days)
  const allStories = board.groups.flatMap((g) => g.stories);
  const recentStories = [...new Map(allStories.map((s) => [s.id, s])).values()]
    .filter((s) => s.status !== "Archived")
    .sort((a, b) => (b.storyNumber ?? 0) - (a.storyNumber ?? 0))
    .slice(0, 6);
  for (const s of recentStories) {
    arrivals.push({
      id: `arr-story-${s.id}`,
      kind: "story",
      label: s.name,
      sub: `Story #${s.storyNumber ?? "?"} · ${s.assigneeNames[0] ?? "Unassigned"} · ${s.clientNames[0] ?? ""}`.replace(
        / · $/,
        "",
      ),
      href: `${baseUrl}/${Tables.Stories.id}/${s.id}`,
      badge: fmtMoney(s.invoice),
      urgency: s.assigneeIds.length === 0 ? "amber" : "violet",
      amount: s.invoice,
    });
  }

  // Sort arrivals: emerald wins → sky → violet → amber, then by recency
  arrivals.sort((a, b) => {
    if (urgencyRank[a.urgency] !== urgencyRank[b.urgency]) {
      return urgencyRank[a.urgency] - urgencyRank[b.urgency];
    }
    return (a.ageDays ?? 999) - (b.ageDays ?? 999);
  });

  return {
    departures: departures.slice(0, 8),
    arrivals: arrivals.slice(0, 8),
  };
}
