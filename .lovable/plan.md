Two small fixes.

### 1. Only show approved-and-signed retainers

`lib/retainer-timesheets.ts` — change `listRetainers()` to only return quotes whose Airtable `Status` is `"Approved and Signed"`. Do this at the query level via `filterByFormula` (`AND({Proposal Type}='Retainer Agreement', {Status}='Approved and Signed')`) so we don't ship inactive rows to the client. The "Active only" checkbox in the UI becomes redundant and gets removed.

Note: this hides retainers in later stages like `Project In Progress` or `Paid`. If those should also count as "active" I'll adjust the formula. Current understanding is "approved and signed" = the exact stage.

### 2. Sidebar + MobileNav icon

Add a matching icon for `/engineering/retainer-timesheets` in both nav components, using the same inline-SVG style already used for the other engineering entries:

- `components/Sidebar.tsx`: add `IconClock` (clock face — reads as "timesheet") and map `"/engineering/retainer-timesheets": <IconClock />` in the `ICONS` record.
- `components/MobileNav.tsx`: add the same clock icon to its icon map at `"/engineering/retainer-timesheets"`.

### Build error

`npm run build` currently succeeds end-to-end and the new route is in the output (`/engineering/retainer-timesheets  2.37 kB  123 kB`). Typecheck is clean. The `dist-check` failure looks stale from the previous turn's async run — I'll re-run the build after the edits above to confirm.

### Files touched

```text
lib/retainer-timesheets.ts        filter to Approved and Signed
components/engineering/RetainerTimesheetsPage.tsx  drop the "Active only" toggle
components/Sidebar.tsx            add clock icon + map for the new route
components/MobileNav.tsx          same icon in the mobile map
```