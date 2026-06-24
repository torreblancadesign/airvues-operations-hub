## Story ordering for Quote Calculator + Change Orders

Add a sortable, drag-and-droppable `#` column to every Quote Calculator and Change Orders table, backed by a new Airtable `Quote Order` number field on Stories (`fldfeJqFh88bHKItW`).

### 1. Schema wiring
- `lib/schema.ts` — register the `Quote Order` field on the Stories table using ID `fldfeJqFh88bHKItW`.

### 2. Data layer (`lib/quotes.ts`, `lib/quote-types.ts`)
- Add `order: number | null` to `QuoteStoryRow`.
- Request `Quote Order` from Airtable when loading quote stories.
- Sort returned `stories[]` ascending by `order ?? Infinity`, tie-break by the quote's existing `Stories` link index (preserves today's behavior for unordered rows).
- Totals and partitioning (original vs change order) are unaffected — they still iterate `stories[]`.

### 3. Mutation (`lib/mutations/story.ts`)
- New `reorderQuoteStories(quoteId, updates: {id, order}[])` server action:
  - `requireRole("admin","lead","editor")`.
  - Batched PATCH to Stories (10 per request) writing `Quote Order`.
  - `revalidateTag("airtable")` + `revalidateTag(\`quote:${quoteId}:stories\`)`.
- `createStory` (the path used by `NewQuoteStoryModal`): default `Quote Order = (max existing order in the same subset) + 10` so new rows append. Original vs change-order subsets are computed independently.

### 4. UI (`components/pipeline/QuoteStoriesTable.tsx`)
- New leftmost `#` column (~56px):
  - Small drag handle (`⋮⋮`) on the left.
  - Inline number input (tabular, 3 chars). Blur/Enter calls `reorderQuoteStories` with just that row's new value.
- Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable` (~12kb total). On drop, re-space the visible subset to `10, 20, 30…` and send one batched mutation.
- Each `QuoteStoriesTable` instance owns its own subset's ordering — dragging in the Quote Calculator never reshuffles Change Orders, and vice versa.
- Read-only (no handle, no input) when `canEdit` is false.

### 5. Files touched
- `lib/schema.ts`
- `lib/quote-types.ts`
- `lib/quotes.ts`
- `lib/mutations/story.ts`
- `components/pipeline/QuoteStoriesTable.tsx`
- `components/pipeline/NewQuoteStoryModal.tsx` (default-order calculation only)
- `package.json` (add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)

### 6. Verification
- `npx tsc --noEmit` + `npm run build`.
- In preview: drag rows in both Quote Calculator and Change Orders; edit a `#` to slot a row to the top; refresh and confirm order persisted in Airtable.
