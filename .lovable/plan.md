## Scope

Eight changes across Accounts, Pipeline, Quote detail, and the stories table.

---

### 1. Accounts page → tabs (Leads / Clients / Lost Leads)

`components/clients/ClientsDashboard.tsx`
- Replace collapsible groups with a tab strip at the top: **Leads · Clients · Lost Leads**.
- Active tab filters the underlying list. Counts shown in each tab pill.
- "Lost Leads" = companies whose Lead Status is `Lost` or `Dead` (filter in `lib/clients.ts` selector; field already loaded — verify in `lib/clients.ts` and `schema.ts`, add field if missing).
- Persist active tab in URL `?tab=leads|clients|lost`.

### 2. Quote detail → editable Deal Stage chip

`app/(app)/pipeline/[id]/page.tsx`
- The header status row currently renders Deal/Journey/Proposal as read-only chips. Replace the **Deal Stage** chip with an inline `<select>` bound to a new server action `updateQuoteDealStage(quoteId, status)` in `lib/mutations/quote.ts` (uses `requireRole`, `revalidateTag("airtable")`).
- Options come from the existing Status field choices in `lib/schema.ts`.
- Same treatment kept consistent with the existing inline edits in `QuoteSheetEditor`.

### 3. Rename "Quote details" → "Project details" + "Client Journey" → "Proposal Status"

- `components/pipeline/QuoteSheetEditor.tsx`: change the Section title from "Quote details" to "Project details".
- `components/pipeline/labels.ts`: change `CLIENT_JOURNEY_LABEL` to `"Proposal Status"` and update help copy. This updates the form label and the header chip prefix everywhere.

### 4. Quote detail → link to the client/account

`app/(app)/pipeline/[id]/page.tsx`
- Pipeline quote rows already carry a `client` name (rendered in subtitle). Resolve the linked Company recId — already available as `quote.companyId` (verify in `lib/pipeline.ts`; if not exposed, add it to the projection).
- In the back-link row, always show **← All quotes** AND **{Client Name} ↗** linking to `/clients/{companyId}`.
- Also wrap the client name in the subtitle as a link to `/clients/{companyId}`.

### 5. Stories table → multi-select + bulk delete/reassign/status

`components/pipeline/QuoteStoriesTable.tsx`
- Add leftmost checkbox column (header = select all in this table) — separate selection set per table instance (Quote Calculator vs Change Orders).
- When >0 selected, render a sticky `BulkBar` above the table with:
  - **Delete** (confirm modal) → new `bulkDeleteQuoteStories(quoteId, ids[])` in `lib/mutations/quote.ts`, batched DELETE via Airtable (10 per request).
  - **Reassign engineer** (PersonPicker) → reuse existing `updateStory` per id, batched (10 per PATCH) via new `bulkUpdateQuoteStories` helper.
  - **Change status** (status dropdown) → same batched updater.
- All gated on `canEdit`. On success: clear selection + refresh parent via existing callback.

### 6. Stories table → inline editing

`components/pipeline/QuoteStoriesTable.tsx`
- Replace open-sheet-only cells with inline editors (debounced blur-commit, same pattern as `QuoteSheetEditor` inline fields):
  - **Name** → text input
  - **Client Notes / Description** → autosize textarea (inline expand on focus)
  - **Hours / Cost** → numeric inputs (existing display already tabnum)
  - **Status** → select (Story Status choices from schema)
  - **Assignees** → reuse existing `PersonPicker` (multi-select) in a popover anchored to the cell
- Each edit calls the existing `updateStory` server action; on success patch local row state to avoid full refetch.
- Row click still opens the StorySheet for full edit; clicks inside an editor `stopPropagation`.

### 7. Pipeline page → Deal Stage tabs (replace filter)

`components/pipeline/PipelineDashboard.tsx` + `components/pipeline/FilterBar.tsx`
- Remove the Deal Stage select from `FilterBar`.
- Add a horizontal tab strip above the table with one tab per Deal Stage value from schema + an **All** tab. Counts in each tab.
- Active tab persisted in URL `?stage=...` via existing `useSearchParamsFilter`.
- Other filters (search, owner, etc.) remain untouched.

### 8. Verification

- `npx tsc --noEmit`
- `npm run build`
- Manual: load `/clients` (switch tabs), `/pipeline` (switch stage tabs), open a quote → edit deal stage inline, click client link, bulk-select 2 stories → delete/reassign/status, inline-edit a name/hours/status/assignee.

---

### Files touched

- `lib/schema.ts` (verify Lead Status field + Companies link on Quote; add if missing)
- `lib/clients.ts` (lost-lead derivation)
- `lib/pipeline.ts` (expose `companyId` on quote rows)
- `lib/mutations/quote.ts` (`updateQuoteDealStage`, `bulkDeleteQuoteStories`, `bulkUpdateQuoteStories`)
- `components/clients/ClientsDashboard.tsx` (tabs)
- `components/pipeline/PipelineDashboard.tsx` (tabs)
- `components/pipeline/FilterBar.tsx` (remove stage select)
- `components/pipeline/labels.ts` (rename Client Journey → Proposal Status)
- `components/pipeline/QuoteSheetEditor.tsx` (rename section title)
- `components/pipeline/QuoteStoriesTable.tsx` (checkboxes, bulk bar, inline editors)
- `app/(app)/pipeline/[id]/page.tsx` (editable Deal Stage chip, client link)
