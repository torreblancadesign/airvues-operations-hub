
# Phase 1 — Client Detail Page (`/clients/[id]`)

A full in-app detail page for any Company. Click a row on `/clients` → open the detail page inside Airvues Ops (no link out to Airtable for navigation). Existing drawer is removed in favor of full-page navigation.

## Route + nav
- New `app/(app)/clients/[id]/page.tsx` (server component, `assertCanAccess("/clients")`).
- `components/clients/ClientsDashboard.tsx`: row `onClick` → `router.push(\`/clients/${c.id}\`)` instead of opening `ClientSheet`. Drop the `ClientSheet` mount.
- Back link in the detail header: "← All clients".

## Airtable fields surfaced (only what exists today)

**Companies (existing fields — confirmed via schema):**
Name, Website, Business Description, Drive Folder, Miro Folder, Created, Contract Type, Hourly Rate, Preferred Business, Engagement Frequency, Has NDA?, Legal Address, Google Chat, Logo.

**Blueprint fields that DON'T exist in Companies yet** (will not be added in Phase 1; shown as "—" with a small "Not in Airtable yet" hint to flag for later):
Industry / Category, Lead Source, Client Start Year, Relationship Notes, Discounts Earned (loyalty / referral % + reason).
When you're ready to add these in Airtable, a follow-up phase will wire them in.

**Contacts** — People where `Company = [companyId]`. Surface: Full Name, Role (title), Primary Email, Phone Number, Type (Internal/External), Status (Active/Onboarding/Innactive/Former), VIP, Client Comments (as "Notes").

**Projects** — Quotes linked to this Company. Use existing rollups on Quote: Project Name, Status, Project Status, Total Cost, Total Paid, Total Hours, Stories count, Prepared Date, Client Delivery Due Date. CO flag = any linked Story has `Change Order = true` (already in `lib/quotes.ts`).

**Invoices** — Invoices whose Payer's Company = this id (same join `lib/clients.ts` already does). Surface: Invoice #, Date, Amount, Status, Days since/until due.

## Page layout
```text
← All clients
┌─ Header ──────────────────────────────────────────────────────┐
│ Company name (logo)                                           │
│ Engagement · Contract Type · Created year · Hourly Rate       │
│ Lifetime $ · Outstanding AR · # invoices · Last invoice (Xd)  │
│ [Website ↗] [Drive ↗] [Miro ↗] [Google Chat ↗]                │
│ At-risk / Misclassified badges if applicable                  │
└───────────────────────────────────────────────────────────────┘
┌─ Overview (2-col) ─────────────────┬─ Relationship notes ─────┐
│ Industry —                          │ — (Not in Airtable yet) │
│ Lead Source —                       │                         │
│ Start Year —                        │                         │
│ Loyalty / Referral discounts —      │                         │
│ NDA on file · Legal address         │                         │
│ Business Description (Companies)    │                         │
└─────────────────────────────────────┴─────────────────────────┘
┌─ Contacts ────────────────────────────────────────────────────┐
│ Name · Title · Email · Phone · Type · Status · Notes          │
└───────────────────────────────────────────────────────────────┘
┌─ Projects ────────────────────────────────────────────────────┐
│ Tabs: Active · Completed · All   (sorted by Prepared Date ↓)  │
│ Project · Deal Stage · Journey · Total · Paid · Hours · CO·▾  │
│   click → opens existing QuoteSheet drawer (in-page overlay)  │
└───────────────────────────────────────────────────────────────┘
┌─ Invoices ────────────────────────────────────────────────────┐
│ # · Date · Amount · Status · Due / Days late                  │
│   click → opens existing InvoiceSheet drawer                  │
└───────────────────────────────────────────────────────────────┘
```

**Project tabs (per your guidance — keep what Airtable already tracks):**
- Active = Status is anything other than `Completion Invoice Paid`, `Lost`, `Archived`.
- Completed = Status `Completion Invoice Paid` or Project Status `Completion Invoice Paid`.
- All = everything linked.

## Data layer
New `lib/client-detail.ts` (server-only) exposing `getClientDetail(companyId)`:
- Read Company (asStr each existing field).
- Read People filtered by `Company` contains `companyId`, sorted by Full Name; map to a `ContactRow[]`.
- Read Quotes where the Client lookup matches this Company (reuse the resolution pattern from `lib/quotes.ts` / `lib/pipeline.ts`), map to a `ProjectRow[]`. For CO badge, do a second pass over Stories of those quotes (or trust the existing rollup if present).
- Reuse `lib/clients.ts` aggregation for `lifetimeRevenue / outstandingAR / invoiceCount / lastInvoiceDate / daysSinceLastInvoice`; refactor so the per-company aggregator is a single exported function used by both `/clients` list and `/clients/[id]`.
- Read Invoices for this company (same Payer→Company join already in `listAllClients`), return them ordered by Date desc.
- All reads tagged `clients`, `client-detail`, `client-detail:${id}` for cache invalidation.

## Components (new)
- `components/clients/ClientDetail.tsx` — server-rendered sections + small client islands for the Projects tab toggle and drawer mounts.
- `components/clients/ClientContactsTable.tsx` — read-only table.
- `components/clients/ClientProjectsTable.tsx` — tabbed table; on row click sets a `selectedQuoteId` and renders the existing `QuoteSheet`. Needs `people` + `sprints` props from the page to satisfy `QuoteSheet`.
- `components/clients/ClientInvoicesTable.tsx` — read-only table; on row click renders existing `InvoiceSheet` (or whatever drawer `/money` uses today).

## What stays / what changes
- `components/clients/ClientSheet.tsx` — removed (replaced by the page). One reference in `ClientsDashboard.tsx` to delete.
- `lib/clients.ts` — split out the per-company aggregator so both routes can call it.

## Out of scope for Phase 1 (deferred to later phases per the gap analysis)
- Editing anything on the page (notes, discounts, contacts) — Phase 7 once Airtable fields exist.
- Project Log / activity timeline — Phase 3.
- Project handoff/delivery assets section on each project — Phase 2.
- Reconciliation of Invoice schema (Invoice Type, Discount Applied, Late status) — Phase 6.
- Engineer Management consolidated view — Phase 4.

## Verification
- `npx tsc --noEmit`
- `npm run build`
- Navigate `/clients` → click any row → land on `/clients/[id]` → confirm: header KPIs match list, contacts list non-empty for known clients, projects tabs filter correctly, clicking a project opens the existing QuoteSheet drawer, clicking an invoice opens the InvoiceSheet drawer, back link returns to `/clients`.
