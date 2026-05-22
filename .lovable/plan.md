## Problem

On `/me` the commission projections and per-story commission numbers all show `$0`.

Root cause: the scorecard derives commission from `Story.invoice`, but engineers actually want commission on `Story.cost` (which is what they get paid against). When `Invoice` is empty/zero on a story, every commission number collapses to 0.

## Fix

Switch the scorecard math from `invoice` to `cost`. Keep the engineering board untouched — this change is scoped to `/me`.

### 1. `lib/scorecard.ts`
- Build `ratedStories` with `commission = (s.cost ?? 0) * commissionPct` instead of `s.invoice * commissionPct`.
- Stop reusing `effectiveGroup.totals.openInvoice` / `earnedInvoice` for commission math. Recompute locally from `ratedStories`:
  - `openCost`   = sum of `cost` for stories where status is active (Todo, In progress, QA Review, Analysis Required, On Hold, Incomplete).
  - `earnedCost` = sum of `cost` for stories where status = Completed.
  - `openCommission`   = `openCost * commissionPct`.
  - `earnedCommission` = `earnedCost * commissionPct`.
- `nextToShip` sorts by `cost` descending (highest-earning ship targets), still filtered to active statuses.
- Expose the cost-based totals on the returned `Scorecard.totals` so the UI can render them.

### 2. `lib/scorecard-types.ts`
- Extend the `totals` shape (or add a sibling block) with `openCost` and `earnedCost` so PersonScorecard can show "scope delivered" in cost terms.

### 3. `components/me/PersonScorecard.tsx`
- `totalPotential` = `totals.openCost + totals.earnedCost`.
- `totalPotentialCommission` = `totalPotential * commissionPct` (unchanged formula, new base).
- "Lifetime shipped" sub: use `totals.earnedCost` (not `earnedInvoice`).
- "Next to Ship" header earnings preview already sums `nextToShip[].commission`, which is now cost-based — no change needed.
- Section totals in "All Your Stories" already sum `s.commission` — automatically correct once stories are rebased on cost.

### 4. Sanity-check rendering
- Keep the existing "Commission · {pct}" chip and the `(default)` hint.
- Keep the goal-pacing block as-is — it tracks real paid earnings, not commission projections.

## Out of scope

- Engineering board (`/engineering`), leaderboard, sprint pages still use `Story.invoice × 15%`. That's a separate decision and the user only asked about the scorecard.
- No Airtable field changes. If a story has `Cost = 0` it'll legitimately project $0 on the scorecard.

## Verify

- `npx tsc --noEmit`
- Open `/me`, pick an engineer, confirm:
  - "Open / Earned / Total pipeline" commission show non-zero numbers when stories have a `Cost`.
  - "Next to Ship" is sorted by highest cost.
  - Per-section totals in "All Your Stories" match `Σ cost × commissionPct`.