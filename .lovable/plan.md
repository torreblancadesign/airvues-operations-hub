## Retainer polish: stories, project page, and monthly grouping

### 1. Schema — add the Completed Date field
`lib/schema.ts` (Stories table)
- Add `"Completed Date": { id: "Completed Date", type: "date" }` (using the field name as the write key until the real `fldXXX` ID is captured, same pattern used for `Change Order`).

### 2. Story shape — surface completedDate
`lib/quote-types.ts`
- Add `completedDate: string | null` to `QuoteStoryRow`.

`lib/quotes.ts`
- Fetch `Completed Date` for each linked Story; map to `completedDate`.

### 3. Monthly bucket — prefer Completed Date, fall back to createdTime
`components/pipeline/QuoteStoriesTable.tsx`
- When `groupByMonth` is true, derive the month label from `completedDate` if present, else from `createdTime` (existing behavior). Stories without a completed date go into a leading "Unscheduled" group.

### 4. New-story modal — retainer-aware
`components/pipeline/NewQuoteStoryModal.tsx`
- Accept a new prop `isRetainer: boolean`.
- When `isRetainer`:
  - Hide the **Cost** input (don't validate, don't send).
  - Show a new **Completed Date** date input (optional; if set, sent on create so the story lands in the right month bucket).
- Non-retainer behavior is unchanged (Cost stays required, no date field).

`lib/mutations/quote.ts` → `createQuoteStory`
- Accept optional `completedDate?: string` and optional `cost?: number` (currently required). For retainers we'll omit cost; Airtable currency field stays empty.
- Write `Completed Date` when provided.

`components/pipeline/QuoteSheetEditor.tsx`
- Pass `isRetainer={quote.proposalType === "Retainer Agreement"}` to `NewQuoteStoryModal`.

### 5. Inline editing — retainer-aware columns
`components/pipeline/QuoteStoriesTable.tsx`
- When `groupByMonth` (i.e. retainer):
  - Hide the **Cost** column entirely (header + cells + totals row Cost).
  - Add a **Completed** date column (inline-editable; editing it moves the row to the corresponding month group on save).
- Keep all other columns/behaviors identical for non-retainers.

`lib/mutations/quote.ts` → `updateQuoteStory` (or the existing inline-edit action)
- Accept `completedDate` patches and write `Completed Date`.

### 6. Project detail — retainer cleanups
`components/pipeline/QuoteSheetEditor.tsx`
When `quote.proposalType === "Retainer Agreement"`:
- Hide the **Change orders** section + the change-order stories block (already kept; remove for retainers).
- Hide the **Delivery due date** field/chip in the header.
- Hide the **Blueprint engagement** toggle.

`app/(app)/pipeline/[id]/page.tsx`
- Mirror the header changes: don't render the delivery-due-date chip for retainers (the Paid-status hide stays for all types).

### 7. Verify
- `npx tsc --noEmit` and `npm run build` (the project's required gates per `CLAUDE.md`).

### Notes / assumptions
- Field name "Completed Date" is used as the write key (matches the `Change Order` pattern in `schema.ts`). When you grab the real `fldXXX` ID later, swap the value in one place.
- "Unscheduled" bucket for retainer stories with no completed date keeps newly-added stories visible until you set a date.
- Non-retainer projects (Airtable Solutions) are untouched by all of these changes.
