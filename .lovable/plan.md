## Goal
Scope the per-quote "uninvoiced" amount to deals the client has actually committed to, and rename the column so its meaning matches the Firm Pulse tile.

## Committed deal stages
Treat these `Status` values as "committed" (client has agreed to pay):
- `Approved and Signed`
- `Awaiting Payment`
- `Project In Progress`
- `Paid`

Excluded (no commitment yet, or dead): `Draft`, `Sent. Awaiting Approval.`, `Auditing 🚩`, `Cancelled`, `Rejected`, and `null`.

Note: `Paid` stays in — a Paid deal will normally compute to 0 uninvoiced, but if Total Cost > invoiced for any reason we still want to see it rather than hide it.

## Changes

### 1. `lib/pipeline.ts`
- Add a local `COMMITTED_STATUSES` set with the four values above.
- When mapping each record, compute `uninvoiced` as `Math.max(0, totalCost - invoiced)` **only when `status` is in the set**; otherwise `uninvoiced = 0`.
- Keep the `listAllInvoices` fetch and `invoicedByQuote` map as-is so the math still reconciles with the Firm Pulse "Committed · uninvoiced" tile.

### 2. `components/pipeline/QuoteTable.tsx`
- Rename column header from **Uninvoiced** to **Committed Uninvoiced**.
- Update the header tooltip to: "Committed but not yet invoiced. Only shown for deals the client has agreed to pay (Approved and Signed, Awaiting Payment, Project In Progress, Paid). Excludes void invoices."
- Cell rendering unchanged: amber + bold when > 0, muted `—` when 0 (which now also covers all pre-commitment stages).

## Out of scope
- No changes to sort key name (`"uninvoiced"` stays as the internal key).
- No changes to Firm Pulse — it already filters to active/committed quotes upstream, so totals continue to reconcile.
- No filter chip for "has committed uninvoiced".

## Verify
- `npx tsc --noEmit`
- On `/pipeline`, sort by Committed Uninvoiced desc: top rows should all be `Project In Progress` / `Awaiting Payment` / `Approved and Signed`; Draft and Awaiting Approval rows show `—`.
- Sum of the column matches the Firm Pulse "Committed · uninvoiced" tile.
