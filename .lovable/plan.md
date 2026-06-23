# Slim ops pages + beef up Firm Pulse

Accounts (`/clients`) and Projects (`/pipeline`) become operational list views. All metrics consolidate into a redesigned Firm Pulse on the home page, grouped into clear bands and joined by the lead KPIs and upcoming-meetings widget.

## 1. `/clients` — pure operational list

`components/clients/ClientsDashboard.tsx`:
- Remove both KPI grids (Active / At-risk / Total revenue / Outstanding / Whale, plus Misclassified / Occasional / Iddle / Lost / New).
- Remove the "Engagement frequency — revenue distribution" bar chart.
- Remove the `kpis` and `engagementDist` `useMemo` blocks (and `TIER` if unused).
- Keep: filter row (search, partner, lead status, count), Type column, table.
- Bucket filter pills (`active`, `at-risk`, etc.) are no longer reachable from KPI tiles — remove the `bucket` state and the `switch (bucket)` arm in `applyFilter`, since the dropdowns cover the operational cuts.

`app/(app)/clients/page.tsx`: change subtitle from "engagement, lifetime revenue, at-risk" to something operational like "Find any account fast. Filter by type or stage."

## 2. `/pipeline` — pure operational list

`components/pipeline/PipelineDashboard.tsx`:
- Remove both KPI rows (Booked / Delivered / Open / Active / Sold / Paid, and the stage-bucket pills row).
- Remove the "Stage breakdown — $ by status" bar chart.
- Remove the `kpis` and `stageBreakdown` `useMemo`s and helpers (`goalTarget`, `goalPct`, `stageBarColor`, `stageMaxTotal`).
- Keep: filter bar, "filtered total" line, `QuoteTable`, `QuoteSheet`.
- Keep the `setStage` / `setStalled` capability via the existing filter bar (stage dropdown already exists there).

## 3. Firm Pulse — redesign + absorb the migrated metrics

`lib/firm-pulse.ts` — add the few aggregates not already exposed:
- `clients`: `{ total, active, atRisk, outstandingAR, top10Pct }` from `listAllClients()`.
- `pipeline`: extend with `bookedYtd/Mtd` already there; add `lostYtd`, `lostMtd`.
- `leads`: extend each window with `inProposal` (lifetime snapshot is fine), `avgDaysBetween`, `avgTimeToMeeting`, `notSold`. Source from `listAllLeads()` already loaded.
- `upcomingMeetings`: top N leads with `meetingDate` in next 14 days (id, name, company, meetingDate, endMeetingDate, meetingLink, status, budget, source, whatToBuild) — server-shaped so the client widget stays pure presentation.

`components/home/FirmPulse.tsx` — restructure into labeled bands so density reads cleanly:

```text
[ Window toggle YTD | MTD ]                                  (top-right)

BAND 1 — Money
  Hero revenue tile (col-span-7)   |  MRR · Open AR · Active work (stack, col-span-5)

BAND 2 — Sales funnel
  Leads (count + conv.) · In Proposal · Booked · Quote→Sold % · Quote→Paid % · Lost

BAND 3 — Accounts
  Total clients · Active · At-risk (>90d) · Outstanding AR · Whale exposure %

BAND 4 — Projects
  Active projects · Completed (window) · New clients (window) · Revenue by source

BAND 5 — Upcoming meetings
  Full-width card reusing UpcomingMeetings rendering (read-only on home — clicking a
  row deep-links to /leads?lead=<id> instead of opening the lead sheet).
```

Each band gets a tiny `<SectionTitle>`-style eyebrow ("Money", "Sales funnel", "Accounts", "Projects", "Schedule") so the wall of tiles parses at a glance. Tone dots stay (emerald/amber/red/sky/violet) for fast scanning. The window toggle continues to re-scope only time-bound tiles.

Extract the meeting row markup from `components/leads/UpcomingMeetings.tsx` into a small shared `MeetingRow` component, then build `components/home/UpcomingMeetingsCard.tsx` that consumes the server-shaped payload from `firm-pulse.ts` and uses links instead of the `onSelect` callback. Leave the leads-page widget intact (it still uses `onSelect`).

`app/(app)/page.tsx`: no structural change — `FirmPulse` already receives `pulse`; just pass the augmented object. The standalone "Needs attention" block stays.

## Out of scope

- Removing KPIs from `/leads` (user said they were already removed; if any remain, they keep working — only home gets the consolidated view).
- Schema/Airtable changes. All new aggregates derive from existing cached reads.
- Mutations, auth, routing changes.

## Technical notes

- `getFirmPulse()` already fetches quotes, leads, invoices, AR. Add one parallel `listAllClients()` call.
- Keep `revalidateTag("airtable")` semantics — no new cache tags needed beyond the existing `kpi:*` / `pipeline:*` umbrellas.
- Preserve `NumberTicker` usage on hero/satellite tiles for visual continuity.
- After edits, run `npx tsc --noEmit` and `npm run build` per CLAUDE.md before declaring done.
