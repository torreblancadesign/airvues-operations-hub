## Goal
Accounts table: swap **Contract** column for a **Date** column ("Communication Start Date" from People), then group rows by Lead vs Client with leads on top sorted by that date (newest → oldest) by default.

## 1. Re-sync schema for the new field
- Hit the Airtable Meta API for the People table (`tbl9wvZY9M7Y7hcf1`) to find the live field ID for **"Communication Start Date"**.
- Add it to `lib/schema.ts` under `Tables.People.fields` with its real ID + type (likely `date`).
- Run `npm run verify-schema` to confirm no drift.

## 2. Plumb the field into `ClientRow`
In `lib/clients.ts`:
- Add `"Communication Start Date"` to the People field-fetch list.
- On the `Primary` tiebreaker, also capture `commStart: string | null`. Keep the existing "person with Partner Status wins" rule; among ties, prefer the **earliest** non-null `Communication Start Date` so the column reflects when the relationship actually began.
- Add `communicationStartDate: string | null` to `ClientRow` and populate from the primary contact.

## 3. Replace Contract column with Date
In `components/clients/ClientsDashboard.tsx`:
- Drop the **Contract** `<th>` and `<td>` (and the unused styling). Keep `c.contractType` off the row.
- Add a new sortable **Started** column after **Type**, right-aligned, mono/tabnum, formatted `MMM YYYY` (or `—`). New `SortKey: "communicationStartDate"`; null sorts last.
- Column count in the empty-state row: `colSpan={7}` stays the same (removed 1, added 1).

## 4. Group leads vs clients + default sort
Still in `ClientsDashboard.tsx`:
- After filtering, partition `sorted` into two arrays by `partnerStatus`: **Leads** (`"Lead"`), **Clients** (`"Client"`), and **Other** (null / unknown).
- Render as three `<tbody>` sections inside the same `<table>`, each preceded by a sticky-ish group header row:
  ```
  ┌────────────────────────────────────────────┐
  │ LEADS · 42                                 │  ← group header tr
  ├────────────────────────────────────────────┤
  │ …lead rows…                                │
  ├────────────────────────────────────────────┤
  │ CLIENTS · 31                               │
  ├────────────────────────────────────────────┤
  │ …client rows…                              │
  └────────────────────────────────────────────┘
  ```
  Header row = single `<td colSpan={7}>` with the existing eyebrow style (`text-[10px] uppercase tracking-wider text-ink-muted bg-bg-elevated`).
- Sorting still applies **within** each group — group order is fixed (Leads → Clients → Other).
- **Default sort**: change initial state to `{ key: "communicationStartDate", dir: "desc" }` so leads land newest-first out of the box.
- When the user changes sort via header click, both groups re-sort by the same key/dir (consistent UX).
- Empty groups are hidden (don't render header for zero rows).

## 5. Verify
- `npx tsc --noEmit`
- `npm run build`
- Visual: load `/clients`, confirm Contract is gone, Date column shows, Leads section is on top sorted newest-first, sort header clicks re-sort both groups.

## Out of scope
- Filter bar, header KPIs, Firm Pulse, `ClientDetailView`, mutations, or any other page.

## Technical notes
- The schema verifier (`scripts/verify-schema.ts`) reads `AIRTABLE_TOKEN` from env; the same token is already used by `lib/airtable.ts`, so the Meta-API lookup runs the same way.
- "Communication Start Date" lives on **People**, not Companies — same plumbing as `partnerStatus`/`leadStatus` today (sourced from the primary contact, not the Company record). This is intentional per your request.
- The `Primary` tiebreaker change (earliest comm-start wins among Partner-Status ties) means accounts with multiple contacts show the **oldest** relationship date, not a random one. If you'd rather show the most recent contact's date, say so and I'll flip the comparator.