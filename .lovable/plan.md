## Leads dashboard — `/leads`

A new top-level page for the `⚪️ Leads` Airtable table, modeled after the existing Pipeline / Money pages so it inherits the same data + UI patterns (server fetch → client dashboard, StatCard tiles, drill-in sheet, deep-link filters).

### Information architecture

```text
PageHeader: "Leads"  · "Inbound demand, intro meetings, conversion"
                          · {count} leads loaded · 5-min cache

┌─ KPI strip (YTD ⇄ MTD toggle on the right) ────────────────────────┐
│ New Leads │ In Proposal │ Sold │ Not Sold │ Win rate │ Avg time-to-meeting │
└────────────────────────────────────────────────────────────────────┘

┌─ Upcoming intro meetings (next 14 days) ───────────────────────────┐
│ Vertical timeline grouped by day                                    │
│  • time · lead name · company · budget chip · source chip           │
│  • [Join Meet] button (opens Meeting Link) when within ±15 min      │
│  • [Open in Airtable] · [View details] (opens LeadSheet)            │
│  Empty state: "No upcoming intros — schedule one in Airtable"       │
└────────────────────────────────────────────────────────────────────┘

┌─ Status funnel ──────────────┐  ┌─ Sources & budgets ──────────────┐
│ Horizontal bar per status:   │  │ Source breakdown (Fillout vs     │
│  New Lead → Needs Review →   │  │  Manually Scheduled) — count + % │
│  In Proposal → Sold/Not Sold │  │ Budget breakdown (<$500, $1k-2k, │
│ Each segment clickable to    │  │  $5k+) — count + share           │
│ filter the table below       │  │ Conversion by source (sold / all)│
└──────────────────────────────┘  └──────────────────────────────────┘

┌─ All leads table ──────────────────────────────────────────────────┐
│ Filter bar: search · status · source · budget · meeting window      │
│ Columns: Created · Name · Company · Title · Budget · Source ·       │
│          Meeting Date · Status · Quotes count                       │
│ Row click → LeadSheet (drawer) with full lead detail + transcript + │
│   linked quotes + assessor                                          │
└────────────────────────────────────────────────────────────────────┘
```

### Metrics (definitions)

Window = `ytd` (Jan 1 → today) or `mtd` (1st of month → today), toggled like Firm Pulse. Time-bound on `Created Time`.

- **New Leads** — count of leads created in window.
- **In Proposal** — count with status `In Proposal Stage` (lifetime, not windowed — pipeline state).
- **Sold** — count with status `Sold` created in window.
- **Not Sold** — count with status `Not Sold` created in window.
- **Win rate** — `Sold / (Sold + Not Sold)` for leads created in window. "—" if denominator 0.
- **Avg time-to-meeting** — mean of `Meeting Date − Created Time` (days) for leads created in window that have a Meeting Date.

Each KPI tile is clickable and deep-links to the leads page with the matching filter applied (`/leads?status=sold`, etc.), same pattern as Money/Pipeline.

### Upcoming intro meetings timeline

- Query: leads with `Meeting Date` ≥ now AND ≤ now+14d, sorted ascending.
- Grouped by day with sticky day headers ("Today", "Tomorrow", "Thu May 22").
- Each card: time (e.g. `9:00 AM PDT`), name, company, status chip, budget chip, source chip, one-line preview of "What are you looking to build?" (truncated).
- **Join Meet button**: primary CTA when `now` is within ±15 min of `Meeting Date` and `Meeting Link` exists; otherwise shows as secondary "Copy link" + "Add to calendar (.ics)" actions. Tooltip shows full meeting time.
- Past meetings (today, already ended) collapse into a "Earlier today" accordion so the timeline always opens on what's next.

### Extra ideas worth adding (lead-gen quality of life)

1. **Stale lead alerts** — leads in `New Lead` or `Needs Review` for >3 days surface as a small red banner above the table with a "Triage now" link.
2. **No-meeting-scheduled flag** — leads created >24h ago with no `Meeting Date` shown as an inline warning chip; helps catch dropped intros.
3. **Conversion-by-source mini chart** — answers "is Fillout actually producing sold deals or just noise?"
4. **Linked Quotes preview in LeadSheet** — clicking a quote opens the existing QuoteSheet so the lead → quote → invoice chain is one click apart.
5. **Assessor avatar** on each row (Team Member Lead Assesser link) so accountability is visible at a glance.
6. **Sparkline of new leads / week** in the New Leads tile (last 12 weeks) for trend at a glance.

### Technical notes

- New `lib/leads.ts` (server-only): `listAllLeads()` using `listRecordsCached` with the field IDs above, cache tag `leads:all`. Returns a flat `Lead` shape with parsed dates and resolved single-link names.
- New `lib/leads-kpi.ts`: pure derivations for the 6 KPI tiles + funnel buckets + source/budget rollups, parameterized by `window`.
- New `app/(app)/leads/page.tsx`: server component → `LeadsDashboard` client component, accepts `searchParams` (`?status=`, `?source=`, `?budget=`) and seeds `initialFilter`.
- New components:
  - `components/leads/LeadsDashboard.tsx` — orchestrates KPI strip + timeline + funnel + table; owns `window` and filter state.
  - `components/leads/KpiStrip.tsx` — reuses `StatCard` and `NumberTicker`; window toggle on the right.
  - `components/leads/UpcomingMeetings.tsx` — timeline component with Join Meet logic (1-min `setInterval` to re-evaluate ±15-min window).
  - `components/leads/StatusFunnel.tsx` — horizontal stacked bar with click-to-filter.
  - `components/leads/SourceBudgetBreakdown.tsx` — two small grouped lists with percentages.
  - `components/leads/LeadsTable.tsx` + `LeadSheet.tsx` + `FilterBar.tsx` + `types.ts` — mirrors `pipeline/` structure.
- Add `/leads` entry to `lib/nav.ts` (sidebar + mobile + optional `showOnHome`).
- No mutations in v1 (read-only). Future: status update from the sheet, gated by `requireRole`.
- No schema changes — all field IDs already exist in `lib/schema.ts` under `Tables.Leads`.

### Out of scope (v1)

- Editing lead status / assignee from the dashboard.
- Email/Slack notifications on stale leads (banner only).
- Calendar two-way sync (we only read `Meeting Date` from Airtable).
