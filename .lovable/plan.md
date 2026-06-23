## Goal
On `/pipeline`, surface the per-project "committed but not yet invoiced" amount and clarify what the existing money column represents.

## Changes

### 1. `lib/pipeline.ts` — add `uninvoiced` per quote
- Import `listAllInvoices` from `lib/money.ts` (already used by Firm Pulse, cached).
- In `listAllQuotes`, after loading quotes, build `invoicedByQuote: Map<quoteId, number>` from invoices (skip `status === "void"`, iterate `inv.quoteRecordIds`, sum `inv.amount`) — same logic as the Firm Pulse tile so the numbers reconcile.
- Add `uninvoiced: number` to `PipelineQuote` and compute `max(0, totalCost - (invoicedByQuote.get(q.id) ?? 0))` for every quote (not just active — keeps the column meaningful when filters change; a Paid/Lost quote will simply be 0).

### 2. `components/pipeline/QuoteTable.tsx` — rename + new column
- Rename the existing **Amount** header to **Quote Total** with a tooltip: "Total contracted value of the quote (Airtable: Total Cost). Not the amount paid."
- Add a new sortable right-aligned column **Uninvoiced** to the right of Quote Total, with tooltip: "Committed but not yet invoiced: Quote Total minus invoices linked to this quote. Excludes void invoices."
  - Render `fmtCurrency(q.uninvoiced)` when > 0; render a muted "—" when 0 so the eye lands on the projects with outstanding work-to-invoice.
  - Update the empty-state `colSpan` from 11 → 12.

### 3. `components/pipeline/types.ts` — sort key
- Add `"uninvoiced"` to `SortKey`.

### 4. `components/pipeline/PipelineDashboard.tsx` — sort handler
- Add a `case "uninvoiced"` branch in `applySort` returning `a.uninvoiced` / `b.uninvoiced`.

## Out of scope
- No filter for "has uninvoiced > 0" (can add later if you want; current sort handles discovery).
- No changes to QuoteSheet, FilterBar, or Firm Pulse math.
- No changes to mutations or Airtable writes.

## Verify
- `npx tsc --noEmit`
- Visual check on `/pipeline`: sort by Uninvoiced desc, confirm the top rows are active in-progress projects with a 50% deposit invoiced, and that totals reconcile against the Firm Pulse "Committed · uninvoiced" tile.
