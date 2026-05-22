## Add Earnings Detail section to /me scorecard

Add a payments ledger table to `PersonScorecard` showing the actual Team Task Payment line items that make up the person's earnings totals — so they can see exactly which jobs/dates contribute to lifetime, YTD, MTD, and outstanding numbers.

### Data layer (`lib/scorecard.ts` + `lib/scorecard-types.ts`)

1. Extend the payment fetch in `getScorecard` to also pull `Function`, `Client`, `Project`, and `Client Invoice` (already pulling Amount, Status, Date, Payee, person lookup).
2. Build a `payments: ScorecardPayment[]` array for the resolved engineer — same filter as today (matching personId, excluding "airvues consulting" payee), sorted by date desc. Include both Paid and Needs Payment rows.
3. Add a `ScorecardPayment` type to `scorecard-types.ts` mirroring the relevant fields from `lib/team.ts`'s `Payment` (id, amount, status, date, function, client, project, airtableUrl).
4. Attach `payments` to the `Scorecard` type.

### UI (`components/me/PersonScorecard.tsx`)

Add a new "Earnings Detail" section after the existing "Earnings" stat cards (and before the goal block), matching the visual style of the team payments table:

- `SectionTitle` "Earnings Detail" with aside showing payment count.
- Compact table: Date · Function · Client/project · Status pill · Amount (right-aligned, tabnum).
- Status pill: emerald for Paid, amber for Needs Payment.
- Payee column omitted (it's always the current person).
- Each row linkable to Airtable via the existing `airtableUrl`.
- Empty state when no payments.
- Cap at e.g. 200 rows with a "showing first 200 of N" footer (paginate later if needed).

### Out of scope

- No filters/search (can add later if needed).
- No changes to commission projections, goal, or stories sections.
- No new permission gating — visibility follows the existing scorecard access.
