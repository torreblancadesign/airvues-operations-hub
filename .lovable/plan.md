
## Goal

Replace the flat 15% `COMMISSION_RATE` on the `/me` scorecard with each person's `Commission Percentage` from the People table, and surface that rate in the UI so people can see what they're earning and what's potentially on the table.

Scope is limited to `/me` (the personal scorecard). The engineering board, leaderboard, and other pages keep the existing flat 15% for now — changing that everywhere would shift numbers org-wide and is a separate decision.

## Changes

**1. `lib/scorecard.ts` — fetch the rate and recompute commissions per person**
- Add `"Commission Percentage"` to the existing `People` field fetch (passed by name, same pattern we used for `Annual Earnings Goal`).
- Read `commissionPct` for the selected engineer. Airtable percent fields come back as decimals (e.g. `0.15` for 15%). Fall back to the global `COMMISSION_RATE` (0.15) when the field is unset.
- Build a recomputed copy of the person's stories where `commission = invoice * commissionPct`, and recompute `openCommission` / `earnedCommission` on `totals` using the same rate. The underlying `story.invoice` numbers are untouched.
- Recompute `nextToShip` from the rate-adjusted stories so the "ship these to earn $X" headline matches.

**2. `lib/scorecard-types.ts` — expose the rate**
- Add `commissionPct: number` to `Scorecard` so the UI can render it and explain the math.

**3. `components/me/PersonScorecard.tsx` — show the rate, drop the hardcoded reference**
- Replace `COMMISSION_RATE` usage with `scorecard.commissionPct`.
- In the header strip, add a small chip near the role/level: `Commission · 15%` (formatted from `commissionPct`).
- Update the "Commission Projections" section aside to read `${pct}% of story invoice · projected, not yet paid` using the person's rate.
- If `commissionPct` came from the fallback (i.e. the People record has no `Commission Percentage` set), show a subtle "default rate — set yours in Airtable" hint under the chip. (Implemented by also returning a `commissionPctSource: "person" | "default"` flag from `getScorecard`.)

**4. No schema.ts edit required right now**
- Same approach as `Annual Earnings Goal` and `Completed Date`: reference `"Commission Percentage"` by name until `lib/schema.ts` is regenerated. We can swap to a field ID later in the same pass as those two.

## Out of scope (call out, don't build)

- Engineering board, leaderboard, sprint pages: still use flat 15%. If you want those to also use per-person rates, that's a follow-up — it changes leaderboard ordering and historical-looking numbers, so worth a separate decision.
- Backfilling missing `Commission Percentage` values in Airtable.

## Verification

- `npx tsc --noEmit`
- Load `/me?as=<your-id>` for a person who has `Commission Percentage` set → confirm the chip shows the right %, "Next to Ship" totals match `invoice × rate`, Commission Projections cards reflect the new rate.
- Load `/me?as=<id>` for someone with the field unset → confirm fallback to 15% with the hint visible.
- Spot-check the `Earnings` strip is unchanged (real paid-out money is independent of the projected rate).

## Open question

Airtable percent fields normally return decimals (`0.15`), but if your `Commission Percentage` field is actually a Number storing whole percents (`15`), the math will be 100× off. Want me to:
- (a) assume decimal (standard Airtable percent field), or
- (b) detect and normalize (treat anything `> 1` as whole percent and divide by 100)?

(b) is safer if you're not 100% sure of the field type. Default to (b) unless you say otherwise.
