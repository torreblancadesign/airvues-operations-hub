# Sales-mode scorecard

Make the scorecard adapt to the person's commission model: engineers keep today's story-driven projections, sales people (like Shania) get a single quote-driven view with no stories sections.

## Airtable changes (you do this)

1. **People table → add field `Commission Model`** (singleSelect)
   - Options: `Stories` (default) and `Sales`
   - Set Shania's value to `Sales`
2. Anyone left blank or set to `Stories` keeps the current engineer layout. Anyone set to `Sales` gets the new layout.

## Logic changes

**Quote eligibility (sales mode only).** Only quotes whose `Project Status` is past the proposal stage count toward commission. Mapping:

- Hidden entirely: `Proposal Created`, `Proposal Signed`
- **Open** (sold, not finished): `Commencement Invoice Paid`, `First Draft Delivered`, `Project Accepted`
- **Earned** (finalized): `Completion Invoice Paid`

Commission per quote stays the same: `Total Cost × (base % + 5% if Blueprint)`.

## UI changes (sales mode)

Render this single flow on `/me` when `Commission Model = Sales`:

```text
Earnings                       (unchanged — real payouts)
Earnings Detail                (unchanged — monthly chart)
YYYY Earnings Goal             (unchanged)

Commission Projections         (REPLACES the current "Sales Commission" + "Commission Projections" stack)
  ├─ Open commission           sum of Open quotes × rate
  ├─ Earned commission         sum of Earned quotes × rate
  ├─ Total pipeline potential  Open + Earned
  └─ MTD / YTD earned          (kept as smaller stat row beneath, drives the goal)

Prepared quotes table          only Open + Earned rows (proposal-stage quotes hidden)
                               Blueprint badge + rate column preserved
```

**Hidden in sales mode:** "Stories Shipped", "Next to Ship", "All Your Stories", and the StorySheet drawer trigger. Assigned stories still exist in Airtable but don't surface here because they don't drive her commission.

**Engineer mode (everyone else):** unchanged. The redundant "Sales Commission" section disappears for engineers too — quote-based commission only renders when `Commission Model = Sales`.

## Files to change

- `lib/schema.ts` — register `Commission Model` field under People
- `lib/scorecard-types.ts` — add `commissionModel: "stories" | "sales"`; rename `salesCommission.open/earned` semantics to match new buckets; drop unused fields
- `lib/scorecard.ts` — read `Commission Model`; filter quotes by `Project Status` (drop Proposal Created/Signed); recompute Open vs Earned by status bucket; still compute story totals but skip them in sales mode
- `components/me/PersonScorecard.tsx` — branch on `commissionModel`. Sales branch renders Earnings + Goal + unified Commission Projections + Prepared quotes table. Engineer branch unchanged minus the sales section.

## Out of scope

- Editing the `Commission Model` value from the app (set in Airtable)
- Splitting commission across multiple `Prepared by` people
- Showing sales metrics anywhere outside `/me`
- Reassigning historical quote statuses

## Verification

`npx tsc --noEmit` + `npm run build`, then load `/me?as=<shania-id>` and confirm: no Stories sections, Prepared quotes shows 4 rows (not 6 — the 2 Proposal Created rows drop), Open = Lampshade $1,200 + Contractor Billing $3,300 = $4,500, Earned = $0 until any quote moves to Completion Invoice Paid. Load `/me?as=<engineer-id>` and confirm the layout is identical to before.
