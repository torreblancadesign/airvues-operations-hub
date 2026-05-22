## Goal

Turn `/me` into a true personal scorecard: real earnings (not just commission-on-invoice), time-bucketed metrics, and a self-set goal the person tracks against. Remove the company bonus pool — it belongs on `/`, not here.

## What changes on the page

**Remove**
- "Company Bonus Pool" section (annual revenue / locked / tier callouts).

**New: Earnings strip (from Team Task Payments, `Status = "Paid"`, joined via `Internal Team Member Account (from Link to Expenses)` — the same join we just fixed for `/team`)**
- Lifetime paid
- Year-to-date paid
- Month-to-date paid
- Outstanding (Status = "Needs Payment") — so they see what's queued

**New: Stories shipped strip**
- Lifetime completed
- YTD completed
- MTD completed
- Active in flight (existing)

For story dates we need a real completion date — see "Airtable fields needed" below. Until that field exists, YTD/MTD story counts will fall back to using `Sprint End (from Sprints)` of the sprint the completed story sits in (close enough for sprint-based work, wrong for stories shipped mid-sprint or moved between sprints).

**New: Personal goal section**
- Reads the signed-in person's goal from People table.
- Shows progress bar: YTD paid earnings vs annual goal, with MTD pace callout ("on track to hit $X / need $Y per month to close the gap").
- If no goal set, shows a quiet prompt ("Set a goal in Airtable") instead of a broken bar.
- Edit-in-app deferred — for now they set it in Airtable, page reflects it.

**Keep**
- Header (name, role, picker — picker stays until OAuth→People mapping ships).
- "Next to Ship" (top 3 highest-invoice active stories).
- "All Your Stories" grouped by status.
- StorySheet drawer.

**Keep but reframe**
- "Open commission" / "Earned commission" / "Pipeline potential" — relabel as "Commission projections" with a small note that this is *projected* from story invoice × 15%, not actual paid earnings. Keep below the real-earnings strip so the hierarchy is: real money first, projections second.

## Airtable fields needed (you create these)

On **People** table:
1. `Annual Earnings Goal` — currency (USD). The dollar amount they want to earn this calendar year.
2. *(optional, nice-to-have)* `Annual Stories Goal` — number. Stories they want to ship this year.

On **Stories** table (strongly recommended — fixes the date-bucketing problem):
3. `Completed Date` — date. Set automatically via Airtable automation when `Story Status` changes to `Completed`, OR set manually. Without this we have to approximate from sprint end dates.

Tell me when these exist and I'll wire them up. I can ship the earnings + goal work against People immediately; the story time-buckets will use the sprint-end fallback until `Completed Date` lands.

## Technical notes

- New data layer: extend `lib/scorecard.ts` to also pull `listTeamData()` (or a narrower query) and filter payments by `personId === engineerId`. Bucket by `Date` field into lifetime / YTD (Jan 1 → today) / MTD (1st of month → today).
- Fetch goal from People in the same call that resolves the engineer (we already read People in `lib/engineering.ts` and `lib/team.ts` — add `Annual Earnings Goal` to one of those reads, or read directly in `scorecard.ts`).
- Extend `Scorecard` type in `lib/scorecard-types.ts`: add `earnings: { lifetime, ytd, mtd, outstanding }`, `shipped: { lifetime, ytd, mtd }`, `goal: { annualEarnings: number | null }`.
- `components/me/PersonScorecard.tsx`: delete `<Company Bonus Pool>` block, add `<EarningsStrip>`, `<ShippedStrip>`, `<GoalProgress>` sections. Reuse existing `StatCard` + `GoalBar`.
- Cache tag the new payment read with `["team:payments", "scorecard"]` so existing invalidation still works.
- Verify with `npx tsc --noEmit` + load `/me?as=<personId>` for a few people (someone with payments, someone without, someone over goal).

## Open question

Should the goal be **calendar year** (resets Jan 1) or **rolling 12 months**? I assumed calendar year — confirm or flip it before I build.
