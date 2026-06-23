## Add "Uncommitted Invoicing" tile to Firm Pulse

Surface dollars that clients have **committed** (signed quote) but we **have not yet invoiced** because work is still in progress.

### Definition

For each active quote (`status ∈ {Approved and Signed, Awaiting Payment, Project In Progress}`):

```
uninvoiced = max(0, quote.totalCost − sum(invoice.amount for invoice in invoices where quote ∈ invoice.quoteRecordIds))
```

Sum across all active quotes. Also return a count of quotes contributing.

This intentionally uses **invoiced total** (not paid total) so the metric represents work that still needs an invoice generated — distinct from existing "Open AR" (invoiced, unpaid) and "Active Work · unpaid" (`amountOwed`, which mixes both).

### Changes

**`lib/firm-pulse.ts`**
- Add `uninvoiced: { value: number; count: number }` to `FirmPulse`.
- In `getFirmPulse`, build a `Map<quoteId, invoicedSum>` from already-loaded `invoices` (iterate `inv.quoteRecordIds`, sum `inv.amount`; skip `status === "void"`).
- During the existing quote loop, when a quote is active, add `max(0, q.totalCost − invoicedByQuote.get(q.id) ?? 0)` to `uninvoicedValue`, increment count when contribution > 0.
- Return it in the result.

**`components/home/FirmPulse.tsx`**
- Add a 4th `Satellite` in the Money band's right stack (or replace grid to 2x2 on lg) titled "Committed · uninvoiced" linking to `/pipeline?stage=active`, tone `violet`, sub: `{count} active project(s) · invoice when shipped`.

### Out of scope

No mutations, no new Airtable reads (reuses cached `listAllQuotes` + `listAllInvoices`), no changes to other tiles' math.

### Verify

`npx tsc --noEmit` + visual check on `/` that the tile renders with a plausible number (active project totalCost minus invoiced sum).
