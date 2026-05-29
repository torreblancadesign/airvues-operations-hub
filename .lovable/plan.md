# Sales-commission scorecard for non-engineers

Right now `/me` assumes the person earns by shipping Stories (Story.Cost × commission %). Shania doesn't ship stories — she earns a % of the **whole quote** she prepared, plus a +5% bonus when that quote is a Blueprint. This plan teaches the scorecard to compute and display that.

## What you need to do in Airtable

1. **Quotes table → add field** `Blueprint`
   - Type: **Checkbox**
   - Default: unchecked
   - Meaning: tick when this quote is a Blueprint engagement (triggers Shania's +5% bonus)
2. **People table → Shania's record**
   - Confirm `Commission Percentage` is set to her base sales rate (e.g. `0.10` for 10%). Airtable percent fields store as decimal.
   - Confirm `Annual Earnings Goal` if you want pacing to work for her too.
3. **Quotes → `Prepared by`** — already exists and links to People. Just make sure historical quotes Shania prepared are linked to her People record (the scorecard uses this link as the source of truth).

That's it on the Airtable side — no new tables, no formulas.

## How the math will work

For each quote where `Prepared by` includes the viewed person:
- `rate = person.Commission Percentage + (Blueprint ? 0.05 : 0)`
- `commission = Quote.Total Cost × rate`
- Bucketing:
  - **Earned** → `Project Status = "Completion Invoice Paid"` (uses `Signed Date` or `Created` as the bucket date for YTD/MTD)
  - **Open / projected** → any other live status (Proposal Created → First Draft Delivered, etc.)
  - **Lost** → excluded (`Status = "Closed Lost"` or equivalent)

## What changes in code

**`lib/schema.ts`** — add `Blueprint` field entry under `Quotes` (raw name access works too, but schema entry keeps it canonical).

**`lib/scorecard-types.ts`** — extend `Scorecard` with:
```
salesCommission: {
  earned: { lifetime, ytd, mtd },
  open: number,
  blueprintBonus: number,   // portion attributable to +5%
  quoteCount: number,
  quotes: SalesQuoteRow[],  // table for drill-down
}
```

**`lib/scorecard.ts`** —
- Fetch all Quotes (cached, tag `scorecard:sales`) with: `Prepared by`, `Total Cost`, `Project Status`, `Status`, `Signed Date`, `Created`, `Project Name`, `Client Name`, `Blueprint`.
- Filter to quotes where `Prepared by` contains `engineerId`.
- Compute per-quote commission using the rule above.
- Sum into lifetime/YTD/MTD earned, open total, and blueprint-bonus subtotal.
- Skip the whole section when the person has zero prepared quotes (engineers won't see it).

**`components/me/PersonScorecard.tsx`** —
- New section **"Sales Commission"** rendered above "Stories Shipped" when `salesCommission.quoteCount > 0`.
- 4 StatCards: Lifetime earned · YTD earned · MTD earned · Open pipeline.
- Small caption noting blueprint bonus contribution (e.g. "+$X,XXX from 2 blueprint quotes").
- Drill-down table listing prepared quotes (project name, client, status, total cost, rate, commission, blueprint badge) — links to `/pipeline` row.

**`components/pipeline/QuoteSheet.tsx` / `QuoteSheetEditor.tsx`** — add a Blueprint checkbox toggle (admin/lead-editable) so the field is reachable from the app, not just Airtable.

**`lib/mutations/quote.ts`** — extend the existing quote field patch to accept `blueprint: boolean`.

**`lib/quote-types.ts`** — add `blueprint: boolean` to `QuoteDetail` and `QuoteFieldPatch`.

## Out of scope (call out before building)

- Reassigning historical quotes to Shania's People record — manual cleanup on your end if any are missing.
- Splitting commission across multiple `Prepared by` people — current rule gives full commission to every linked person. Flag if you want it split.
- Showing Shania's commission inside the existing `/pipeline` quote drawer beyond the new checkbox (can add later).
- Removing the Stories/Commission Projections section for non-engineers — it will just show zeros for her. Easy follow-up to hide when `totals.storyCount === 0`.

## Verification

`npx tsc --noEmit` + `npm run build`, then load `/me?as=<shania-id>` and confirm Sales Commission section appears with non-zero numbers; toggle Blueprint on a quote and confirm the YTD figure jumps by 5% × Total Cost.
