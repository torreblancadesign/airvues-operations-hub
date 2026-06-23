## Two fixes

### 1. Story cost not saving to Airtable

**Root cause:** Stories have two currency fields in Airtable: `Cost` and `Invoice`. The story reader (`lib/engineering.ts`) maps `Story.cost` ← `"Cost"`, but `updateStory` in `lib/mutations/story.ts` only writes to `"Invoice"`. So editing Cost in the StorySheet writes to `Invoice`, the StorySheet re-reads `Cost`, and the value appears unchanged. (Story creation in `lib/mutations/quote.ts` already writes both fields — only the update path is wrong.)

**Fix:** In `lib/mutations/story.ts` `buildStoryFields`, when `patch.invoice` is provided, write the value to **both** `"Cost"` and `"Invoice"` so the two stay in sync (same convention `createQuoteStory` already uses).

That's the only change needed — the StorySheet already calls `save({ cost: val ?? 0 }, { invoice: val })`, so its optimistic update is correct.

### 2. Show "Invoiced" amount per quote on the Pipeline page

Right now the Pipeline table shows `Quote Total` and `Committed Uninvoiced`. We already fetch every non-void invoice and bucket by quote (see `invoicedByQuote` in `lib/pipeline.ts`), so we just need to expose and render it.

**`lib/pipeline.ts`:**
- Add `invoiced: number` to `PipelineQuote`.
- Set `invoiced: invoiced` in the return object (the variable already exists from the `invoicedByQuote` map).

**`components/pipeline/types.ts`:**
- Add `"invoiced"` to `SortKey`.

**`components/pipeline/PipelineDashboard.tsx`:**
- Add `case "invoiced"` to `applySort`.

**`components/pipeline/QuoteTable.tsx`:**
- Insert a new sortable **Invoiced** column between `Quote Total` and `Committed Uninvoiced`.
- Tooltip: "Total invoiced to date across all non-void invoices for this quote."
- Right-aligned, mono/tabnum; show `fmtCurrency(q.invoiced)` when > 0, else muted `—`.
- Bump empty-state `colSpan` from 12 → 13.

After this, each row reads left→right as: `Quote Total` (contracted) · `Invoiced` (billed so far) · `Committed Uninvoiced` (still to bill). The three reconcile: `Quote Total − Invoiced = Committed Uninvoiced` for committed deals.

**Note on "paid" vs "invoiced":** your message said "already paid (invoiced)". These are different — `Invoiced` is what we've billed; `Total Paid` (already on the quote record) is what the client has actually paid. I'm adding the **Invoiced** column because it's what reconciles with Committed Uninvoiced. If you also want a `Paid` column (or to swap Invoiced for Paid), say the word and I'll add it.

### Verify

- `npx tsc --noEmit` clean.
- Open a Story sheet, edit Cost, blur, reopen → value persists; Airtable record shows new `Cost` (and `Invoice`).
- On `/pipeline`, for any committed-stage row: `Quote Total = Invoiced + Committed Uninvoiced`.
