// Recent-activity aggregator. Derives last-24h events from Airtable
// createdTime + status-fields where available. No mutation audit log yet.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import type { ActivityEvent } from "./activity-types";

const baseUrl = process.env.AIRTABLE_BASE_ID
  ? `https://airtable.com/${process.env.AIRTABLE_BASE_ID}`
  : "https://airtable.com";

const DAY_MS = 24 * 60 * 60 * 1000;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export async function getRecentActivity(limit = 12): Promise<ActivityEvent[]> {
  const cutoff = Date.now() - DAY_MS;

  const [stories, invoices, quotes, sprints] = await Promise.all([
    listRecordsCached<{
      "Story Name"?: string;
      "Story Status"?: string;
      "Client (from Epic)"?: string[];
    }>(
      Tables.Stories.id,
      {
        fields: [
          Tables.Stories.fields["Story Name"].id,
          Tables.Stories.fields["Story Status"].id,
          Tables.Stories.fields["Client (from Epic)"].id,
        ],
        maxRecords: 200,
        sort: [{ field: Tables.Stories.fields["Story Name"].id, direction: "desc" }],
      },
      ["activity"],
    ),
    listRecordsCached<{
      "Invoice Identifier"?: string;
      "Invoice ID"?: number;
      "Invoice Status"?: string;
      "Invoice Amount"?: number;
      "Invoice Status Last Modified"?: string;
      Date?: string;
    }>(
      Tables.Invoices.id,
      {
        fields: [
          Tables.Invoices.fields["Invoice Identifier"].id,
          Tables.Invoices.fields["Invoice ID"].id,
          Tables.Invoices.fields["Invoice Status"].id,
          Tables.Invoices.fields["Invoice Amount"].id,
          Tables.Invoices.fields["Invoice Status Last Modified"].id,
          Tables.Invoices.fields["Date"].id,
        ],
        maxRecords: 200,
      },
      ["activity"],
    ),
    listRecordsCached<{
      "Project Name"?: string;
      "Company Name"?: string[];
      "Client Name"?: string[];
      Status?: string;
    }>(
      Tables.Quotes.id,
      {
        fields: [
          Tables.Quotes.fields["Project Name"].id,
          Tables.Quotes.fields["Company Name"].id,
          Tables.Quotes.fields["Client Name"].id,
          Tables.Quotes.fields["Status"].id,
        ],
        maxRecords: 100,
      },
      ["activity"],
    ),
    listRecordsCached<{
      "Sprint Name"?: string;
      "Sprint Number"?: number;
      "Sprint Status"?: string;
    }>(
      Tables.Sprints.id,
      {
        fields: [
          Tables.Sprints.fields["Sprint Name"].id,
          Tables.Sprints.fields["Sprint Number"].id,
          Tables.Sprints.fields["Sprint Status"].id,
        ],
        maxRecords: 50,
      },
      ["activity"],
    ),
  ]);

  const events: ActivityEvent[] = [];

  // Stories — created in last 24h
  for (const s of stories) {
    const t = new Date(s.createdTime).getTime();
    if (t < cutoff) continue;
    const name = s.fields["Story Name"] ?? "Untitled story";
    const client = (s.fields["Client (from Epic)"] as string[] | undefined)?.[0];
    events.push({
      id: `story-c-${s.id}`,
      at: s.createdTime,
      kind: "story_created",
      text: `New story · ${name}${client ? ` · ${client}` : ""}`,
      href: `${baseUrl}/${Tables.Stories.id}/${s.id}`,
    });
  }

  // Invoices — created in last 24h
  for (const inv of invoices) {
    const t = new Date(inv.createdTime).getTime();
    if (t >= cutoff) {
      const identifier =
        inv.fields["Invoice Identifier"] ?? `Invoice #${inv.fields["Invoice ID"] ?? "?"}`;
      const label = identifier.split("|")[0]?.trim() || identifier;
      const amount = inv.fields["Invoice Amount"];
      events.push({
        id: `inv-c-${inv.id}`,
        at: inv.createdTime,
        kind: "invoice_created",
        text: `Invoice created · ${label}${amount ? ` · ${fmtMoney(amount)}` : ""}`,
        href: `${baseUrl}/${Tables.Invoices.id}/${inv.id}`,
      });
    }
    // Invoice marked Paid in last 24h (status-last-modified)
    const statusModified = inv.fields["Invoice Status Last Modified"];
    if (
      inv.fields["Invoice Status"] === "paid" &&
      statusModified &&
      new Date(statusModified).getTime() >= cutoff
    ) {
      const identifier =
        inv.fields["Invoice Identifier"] ?? `Invoice #${inv.fields["Invoice ID"] ?? "?"}`;
      const label = identifier.split("|")[0]?.trim() || identifier;
      const amount = inv.fields["Invoice Amount"];
      events.push({
        id: `inv-p-${inv.id}`,
        at: statusModified,
        kind: "invoice_paid",
        text: `Invoice paid · ${label}${amount ? ` · ${fmtMoney(amount)}` : ""}`,
        href: `${baseUrl}/${Tables.Invoices.id}/${inv.id}`,
      });
    }
  }

  // Quotes — created in last 24h
  for (const q of quotes) {
    const t = new Date(q.createdTime).getTime();
    if (t < cutoff) continue;
    const project = q.fields["Project Name"] ?? "Quote";
    const company =
      (q.fields["Company Name"] as string[] | undefined)?.[0] ??
      (q.fields["Client Name"] as string[] | undefined)?.[0] ??
      "";
    const isWon = q.fields.Status === "Approved and Signed" || q.fields.Status === "Paid";
    events.push({
      id: `quote-c-${q.id}`,
      at: q.createdTime,
      kind: isWon ? "quote_won" : "quote_created",
      text: `${isWon ? "Quote won" : "New quote"} · ${project}${company ? ` · ${company}` : ""}`,
      href: `${baseUrl}/${Tables.Quotes.id}/${q.id}`,
    });
  }

  // Sprints — created in last 24h
  for (const s of sprints) {
    const t = new Date(s.createdTime).getTime();
    if (t < cutoff) continue;
    const name =
      s.fields["Sprint Number"] != null
        ? `Sprint #${s.fields["Sprint Number"]}`
        : (s.fields["Sprint Name"] ?? "Sprint");
    const done = s.fields["Sprint Status"] === "Done";
    events.push({
      id: `sprint-c-${s.id}`,
      at: s.createdTime,
      kind: done ? "sprint_done" : "sprint_created",
      text: done ? `${name} closed` : `${name} started`,
      href: `/sprints/${s.id}`,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, limit);
}
