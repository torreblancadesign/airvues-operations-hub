# Change Orders on Quotes

Add a dedicated Change Orders section to the Quote drawer, backed by two new Airtable fields the user is adding:
- Quotes → `Change Order Details` (long text)
- Stories → `Change Order` (checkbox)

A story is either part of the original scope or a change order. Both still link to the same Quote. Totals are shown separately for Original Scope and Change Orders, plus a Grand Total.

## Prereqs (user does in Airtable)
1. Quotes table: add long-text field exactly `Change Order Details`.
2. Stories table: add checkbox field exactly `Change Order`.
3. Tell me when done — I'll grab the field IDs and add them to `lib/schema.ts`.

## Schema + types
- `lib/schema.ts`: add `"Change Order Details"` to Quotes and `"Change Order"` to Stories with their real fldXXX IDs.
- `lib/quote-types.ts`:
  - `QuoteStoryRow` gets `isChangeOrder: boolean`.
  - `QuoteDetail` gets `changeOrderDetails: string`, `originalTotalCost`, `originalTotalHours`, `changeOrderTotalCost`, `changeOrderTotalHours`. `totalCost` / `totalHours` stay as the grand total (current rollup).
  - `QuoteFieldPatch` gets `changeOrderDetails?: string`.

## Data layer
- `lib/quotes.ts` (`getQuoteDetail`):
  - Read `Change Order Details` (asStr) and `Change Order` per story (boolean).
  - Include the new fields in the Stories `fields:` list.
  - Compute `originalTotal*` and `changeOrderTotal*` by partitioning `stories` (sum hours/cost where defined).
- `lib/mutations/quote.ts`:
  - `buildQuoteFields` + `validatePatch`: handle `changeOrderDetails` (max 50k chars, same as other long-text).
  - `CreateQuoteStoryInput`: add `isChangeOrder?: boolean`; when true, set `Change Order` field on create.

## UI
- `components/pipeline/QuoteSheetEditor.tsx`:
  - Below the existing Stories block, render a new section "Change Orders" with:
    - `Change Order Details` long-text editor (same save pattern as other long-text fields, autosave/blur like existing). Internal-chip styling consistent with other fields (PortalChip if client-visible — confirm with user; defaulting to PortalChip since they'll likely want it on the proposal).
    - A second `QuoteStoriesTable` filtered to change-order stories, with its own subtotal header "Change Order total", and an "+ Add change order story" button that opens `NewQuoteStoryModal` pre-flagged.
  - Original Stories table header changes to "Original Scope total"; only renders non-CO stories.
  - At the bottom of the Stories area, add a single "Grand total" strip (Original + Change Orders).
- `components/pipeline/QuoteStoriesTable.tsx`:
  - Accept optional props: `title`, `addLabel`, hide the table if `stories` is empty AND `hideWhenEmpty`.
  - Otherwise unchanged.
- `components/pipeline/NewQuoteStoryModal.tsx`:
  - Accept `isChangeOrder?: boolean` prop; pass through to `createQuoteStory`. Show a small badge in the modal header when true ("Change order").

## Filtering rules in the editor
- Original Scope table: `stories.filter(s => !s.isChangeOrder)`.
- Change Orders table: `stories.filter(s => s.isChangeOrder)`.
- Story drawer (StorySheet) opened from either table is unchanged.

## Out of scope (call out, don't build)
- Surfacing change orders on /engineering, /backlog, /sprints filters.
- Separate commission math for change orders.
- Toggling a story between original/CO from inside StorySheet (can add later if needed).
- Touching the public proposal/portal rendering of change orders.

## Verification
- `npx tsc --noEmit` + `npm run build`.
- Open a quote in `/pipeline`, add a regular story (lands in Original Scope), add a CO story (lands in Change Orders), edit `Change Order Details`, refresh and confirm persistence + totals.
