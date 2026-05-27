// Global search index — flat list of records & routes for the Cmd+K palette.
// Server-only. Cached for 5 minutes via listRecordsCached.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { NAV_ITEMS } from "./nav";

export type SearchItem = {
  id: string;
  type: "client" | "story" | "quote" | "invoice" | "person" | "route";
  title: string;
  subtitle?: string;
  href: string;
  keywords: string;
};

const baseUrl = process.env.AIRTABLE_BASE_ID
  ? `https://airtable.com/${process.env.AIRTABLE_BASE_ID}`
  : "https://airtable.com";

export async function getSearchIndex(): Promise<SearchItem[]> {
  const [companies, stories, quotes, invoices, people] = await Promise.all([
    listRecordsCached<{
      Name?: string;
      "Engagement Frequency"?: string;
    }>(
      Tables.Companies.id,
      {
        fields: [
          Tables.Companies.fields["Name"].id,
          Tables.Companies.fields["Engagement Frequency"].id,
        ],
      },
      ["search-index"],
    ),
    listRecordsCached<{
      "Story Name"?: string;
      "Story Status"?: string;
      "Client (from Epic)"?: string[];
      Client?: string[];
    }>(
      Tables.Stories.id,
      {
        fields: [
          Tables.Stories.fields["Story Name"].id,
          Tables.Stories.fields["Story Status"].id,
          Tables.Stories.fields["Client (from Epic)"].id,
          Tables.Stories.fields["Client"].id,
        ],
      },
      ["search-index"],
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
      },
      ["search-index"],
    ),
    listRecordsCached<{
      "Invoice Identifier"?: string;
      "Invoice ID"?: number;
      "Invoice Status"?: string;
      "Invoice Amount"?: number;
    }>(
      Tables.Invoices.id,
      {
        fields: [
          Tables.Invoices.fields["Invoice Identifier"].id,
          Tables.Invoices.fields["Invoice ID"].id,
          Tables.Invoices.fields["Invoice Status"].id,
          Tables.Invoices.fields["Invoice Amount"].id,
        ],
      },
      ["search-index"],
    ),
    listRecordsCached<{
      "Full Name"?: string;
      "First Name"?: string;
      "Last Name"?: string;
      Email?: string;
    }>(
      Tables.People.id,
      {
        fields: [
          Tables.People.fields["Full Name"].id,
          Tables.People.fields["First Name"].id,
          Tables.People.fields["Last Name"].id,
        ],
      },
      ["search-index"],
    ),
  ]);

  const items: SearchItem[] = [];

  for (const n of NAV_ITEMS) {
    if (!n.showInSidebar) continue;
    items.push({
      id: `route-${n.href}`,
      type: "route",
      title: n.label,
      subtitle: n.desc,
      href: n.href,
      keywords: `${n.label} ${n.desc ?? ""} ${n.group}`.toLowerCase(),
    });
  }

  for (const c of companies) {
    const name = c.fields["Name"];
    if (!name) continue;
    items.push({
      id: c.id,
      type: "client",
      title: name,
      subtitle: c.fields["Engagement Frequency"] ?? undefined,
      href: `/clients?open=${c.id}`,
      keywords: name.toLowerCase(),
    });
  }

  for (const s of stories) {
    const name = s.fields["Story Name"];
    if (!name) continue;
    items.push({
      id: s.id,
      type: "story",
      title: name,
      subtitle: s.fields["Story Status"] ?? undefined,
      href: `/backlog?open=${s.id}`,
      keywords: `${name} ${s.fields["Story Status"] ?? ""}`.toLowerCase(),
    });
  }

  for (const q of quotes) {
    const title = q.fields["Project Name"] ?? "Quote";
    const company =
      (q.fields["Company Name"] as string[] | undefined)?.[0] ??
      (q.fields["Client Name"] as string[] | undefined)?.[0] ??
      "";
    items.push({
      id: q.id,
      type: "quote",
      title,
      subtitle: [company, q.fields.Status].filter(Boolean).join(" · ") || undefined,
      href: `${baseUrl}/${Tables.Quotes.id}/${q.id}`,
      keywords: `${title} ${company} ${q.fields.Status ?? ""}`.toLowerCase(),
    });
  }

  for (const inv of invoices) {
    const identifier =
      inv.fields["Invoice Identifier"] ?? `Invoice #${inv.fields["Invoice ID"] ?? "?"}`;
    const title = identifier.split("|")[0]?.trim() || identifier;
    items.push({
      id: inv.id,
      type: "invoice",
      title,
      subtitle: [inv.fields["Invoice Status"], inv.fields["Invoice Amount"] != null
        ? `$${Math.round(inv.fields["Invoice Amount"]!).toLocaleString()}`
        : null].filter(Boolean).join(" · ") || undefined,
      href: `/money?open=${inv.id}`,
      keywords: `${identifier} ${inv.fields["Invoice Status"] ?? ""}`.toLowerCase(),
    });
  }

  for (const p of people) {
    const name =
      p.fields["Full Name"] ??
      [p.fields["First Name"], p.fields["Last Name"]].filter(Boolean).join(" ");
    if (!name) continue;
    items.push({
      id: p.id,
      type: "person",
      title: name,
      href: `${baseUrl}/${Tables.People.id}/${p.id}`,
      keywords: name.toLowerCase(),
    });
  }

  return items;
}
