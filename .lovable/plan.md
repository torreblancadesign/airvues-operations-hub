# Display-only metric upgrades (no Airtable changes)

Scope filter: only items where the field already exists in Airtable and is already pulled (or trivially pullable) by an existing `lib/*.ts` data layer. Anything that needs a new column, new table, new webhook, or new workflow is **out of scope** for this pass.

---

## 1. Home / Overview — new KPI tiles

`lib/firm-pulse.ts` already computes revenue + MRR + AR. Extend it (read-only, same cached calls) with:

- **Leads YTD** — count of `Leads` with `Created Time` ≥ Jan 1.
- **New Clients YTD** — count of distinct `Invoice Payer` whose first invoice landed YTD (already have all invoices via `listAllInvoices`).
- **Lead → Sold conversion %** — `Sold / total leads YTD` from existing `lib/leads.ts` source.
- **Active Projects** — count of Quotes/Projects where `Project Status` ∈ {Proposal Signed, Commencement Invoice Paid, First Draft Delivered}.
- **Completed Projects YTD** — `Project Status = "Completion Invoice Paid"`, scoped to YTD.
- **Revenue by Lead Source** — join `Leads.Source` → `Companies` → `Invoices` if linked, else show invoice-source mix (Stripe/Fiverr/Other) which we already have. Render as a tiny breakdown row, not a chart.

Render in `FirmPulse` as a second row of 4–6 small tiles under the existing hero KPIs. No new component primitives needed — reuse `HomeKpiCard`.

## 2. Money page — Late vs Unpaid split + Upcoming Payments

`Invoices.Invoice Status` already contains `"past due"`, `"open"`, `"sent"`, `"unsent"`, `"paid"`, `"subscribed"`, etc. `Date` field is already loaded.

- **Split the existing "Open" KPI into two tiles:**
  - **Unpaid (current)** — status ∈ {open, sent, unsent} AND `Date` ≥ today (or null).
  - **Late** — status = `"past due"` OR (status ∈ open/sent/unsent AND `Date` < today).
- **Upcoming Payments panel** — table of unpaid invoices sorted by `Date` ascending, next 30 days. Columns: payer, amount, due date, days-until. Place above the existing invoice table.
- **Invoice Type breakdown strip** — small inline counts of `Invoice Type` (One-time / Recurring / Payment Plan) using the already-loaded field. Useful context, no chart.

## 3. Pipeline / Quotes — Project Status progress bar

`Project Status` is a 7-stage enum already in `lib/schema.ts`. On the existing Quote rows and `QuoteSheet`, render a 7-segment progress bar (filled up to current stage). Pure visual; no data fetch changes.

## 4. Engineering — bottleneck signal

`Story Status` already powers the board. Add a one-line indicator above `EngineeringBoard`:
- Count of stories stuck in `QA Review` > 7 days (use `Last Modified` if loaded; if not, skip — verify in build phase).
- Count of `Analysis Required` stories (signals stalled discovery).

Lightweight banner, same pattern as the existing stale-leads banner.

---

## Technical notes

- All changes live in: `lib/firm-pulse.ts`, `components/home/FirmPulse.tsx`, `lib/money.ts` (only if we need a derived `isLate` flag), `components/money/MoneyDashboard.tsx`, `components/money/InvoiceTable.tsx` (new "Upcoming Payments" subcomponent), `components/pipeline/QuoteTable.tsx` + `QuoteSheet.tsx`, `components/engineering/EngineeringBoard.tsx`.
- No new Server Actions. No mutations. No `lib/mutations/*` edits.
- No `lib/schema.ts` changes — every field referenced is already mapped.
- All reads go through existing `listRecordsCached` calls; we only widen the `fields[]` array where a needed field isn't yet requested (verified case-by-case in build phase).
- Tag-based cache invalidation untouched.

## Explicitly out of scope (deferred — needs Airtable changes or new workflows)

- Project entity as distinct from Quote/Sprint
- Change Orders
- Discount Applied / Discounts Earned rollup
- Active Contacts sub-table
- Project Log / audit timeline
- Handoff Folder
- Client-facing external portal
- Cal.com webhook → auto-Lead, new-Lead modal, CM notifications
- Proposal Review workflow, Proposal Type enum, "Audited" status
- 14-day project deadline flag
- Retainer Relationships dedicated view

These were in the earlier audit but each requires either a new Airtable field/table or a workflow change, which you've deferred.
