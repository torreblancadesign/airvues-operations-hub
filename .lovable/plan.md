## Goal
Remove dollar columns from the backlog list and surface hours + quote name instead. Client column already exists but make sure it's visible at the same breakpoint as the new columns.

## Changes

**`components/backlog/BacklogRow.tsx`**
- Remove the `$` (invoice) and `Comm` (commission) columns.
- Keep the `Hrs` column and promote it so it's visible at all breakpoints (drop the `hidden sm:table-cell`).
- Add a new `Quote` column showing `story.quoteLabels[0] ?? "—"`, truncated, hidden on small screens (`hidden lg:table-cell`).
- Keep Client visible from `md` up (unchanged).

**`components/backlog/BacklogList.tsx`**
- Update the `<thead>` to match: remove `$` and `Comm` headers, add `Quote` header, make `Hrs` always visible.
- Update the empty-state `colSpan` from 10 to 9 (one net column removed: -2 dollar, +1 quote).
- Update the KPI strip: replace the "Scope value" StatCard (which shows `fmtMoney(totals.invoice)` + commission) with something hours-oriented. Proposal: keep "Scoped hours" as-is and replace "Scope value" with a second hours-related card such as **"Avg hrs / story"** (`totals.hours / filtered.length`), since dollar totals are being de-emphasized on this page.
- Drop the unused `fmtMoney` / `COMMISSION_RATE` imports if no longer referenced.

## Out of scope
- The StorySheet drawer still shows invoice/commission internally — only the list view is changing.
- No data-layer changes; `quoteLabels` is already on `Story`.

## Verification
- `/backlog` table shows: ID, Story, Status, Assignee, Client, Quote, Hrs, Sprint — no dollar columns.
- KPI strip shows no dollar totals.
- Existing filters, bulk-select, row click → drawer all still work.
