## Retainer Timesheets page

New page at `/engineering/retainer-timesheets` (sits under the Engineering nav group) that gives engineers a fast surface to log stories against any active retainer, reusing the retainer-stories editor already built into the Projects drawer.

### UX

- Route added to `lib/nav.ts` under the **Engineering** group, right after Backlog/Sprints. Sidebar + MobileNav pick it up automatically.
- Page layout:
  1. `PageHeader` — "Retainer Timesheets", subtitle explaining "Log stories against any active retainer."
  2. **Retainer picker strip** — one card per Retainer Agreement quote, showing client name, retainer project name, current month's total hours + story count. Search box + toggle for "Active only" (hide Lost/Paid-out).
  3. **Selected retainer panel** — when a card is clicked, the same monthly-grouped stories table used inside the Projects drawer appears inline, scoped to that retainer. Full inline edit, add-story, tag sub-grouping, month totals — identical behavior to what already ships in `QuoteSheetEditor`.
- Deep link support: `?retainer=<quoteId>` selects a retainer on load and updates on click. Refresh-safe, shareable.
- Empty state when no retainers exist.

### Data

- New server module `lib/retainer-timesheets.ts`:
  - `listRetainers()` — cached read (`retainer-timesheets:list` tag + `airtable` umbrella). Filters Quotes where `Proposal Type = "Retainer Agreement"` and status is not `Lost`. Returns lightweight rows (id, projectName, clientName, statusChip, currentMonthHours, currentMonthStoryCount).
  - Reuses existing `getQuoteDetail(id)` from `lib/quotes.ts` for the selected retainer.
- No new mutations. Existing `updateStory`, `createQuoteStory`, `bulkUpdateQuoteStoriesFields`, `reorderQuoteStories` are used through the shared table.

### Permissions

- `assertCanAccess("/engineering/retainer-timesheets")` — grant to **admin, lead, engineer** in `lib/permissions.ts`.
- Story mutation gate in `lib/mutations/story.ts` currently rejects `engineer`. To let engineers log their own retainer stories, `createQuoteStory` and `updateStory` (only the fields the timesheet exposes: name, description, hours, tags, assignees, completedDate, status) will accept `engineer` as well. Admin/lead retain full field access.
- `canEdit` on the page is true for any user who passes the page guard.

### Components

- New `components/engineering/RetainerTimesheetsPage.tsx` (client component) — retainer picker + selected-panel state + URL sync.
- New `components/engineering/RetainerCard.tsx` — one retainer summary card.
- `QuoteStoriesTable` is imported and rendered as-is with `groupByMonth={true}` and the existing tag sub-grouping. No fork.

### Files touched

```text
app/(app)/engineering/retainer-timesheets/page.tsx   NEW (server)
components/engineering/RetainerTimesheetsPage.tsx    NEW (client)
components/engineering/RetainerCard.tsx              NEW (client)
lib/retainer-timesheets.ts                           NEW (server)
lib/nav.ts                                           add nav entry
lib/permissions.ts                                   grant route + roles
lib/mutations/story.ts                               widen gate to include engineer for the retainer-safe fields
```

### Verification

- `npx tsc --noEmit` + `npm run build` clean.
- Sign in as an engineer: page loads, retainer list shows, selecting one shows current-month stories, add-story + inline edit + tag edit all persist to Airtable and stick on-screen (relies on the recent optimistic-state fix in `QuoteStoriesTable`).
- Sign in as admin: unchanged Projects drawer behavior confirmed on `/pipeline/[id]`.