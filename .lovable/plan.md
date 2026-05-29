## Add "Pay Status (from Quote)" to story detail views

You added a new lookup field `Pay Status (from Quote)` on the Stories table. This plan wires it into every place a story's detail is shown.

### What changes

1. **Type layer** (`lib/engineering-types.ts`)
   - Add `payStatus: string[]` to the `Story` type.

2. **Data layer** (`lib/engineering.ts`)
   - In `getEngineeringBoard()` bulk fetch, include `"Pay Status (from Quote)"` in the fields list (raw name, same pattern as `"Completed Date"`).
   - In the story mapper, extract `payStatus: asArray<string>(f["Pay Status (from Quote)"])`.
   - In `getStoryById()` single-story fetch, include the same field and extract it identically.

3. **Story detail drawer** (`components/engineering/StorySheet.tsx`)
   - In the top Context block (where Client / Quote / Description live), add a **Pay Status** row.
   - Color-coded: green for values containing "Paid", amber for "Partial"/"Deposit", muted otherwise.
   - Values joined with ", " since a story can link to multiple quotes.

4. **Kanban card** (`components/sprints/KanbanCard.tsx`)
   - Add a small pill/badge next to the invoice amount showing the first pay status value.
   - Same color coding as StorySheet.

5. **Engineering board card** (`components/engineering/StoryCard.tsx`)
   - Add a small pill below the quote label showing the first pay status value.
   - Same color coding.

### Out of scope
- Adding to BacklogRow table (the table is already dense; the detail drawer is the right place).
- Adding to QuoteStoriesTable (pipeline quote view is client-context, not story-context).
- Schema regeneration (field ID unknown; raw name is safe for reads).

### Verification
- `npx tsc --noEmit` must pass.
- `npm run build` must pass.