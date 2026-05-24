## Goal

On the quote sheet's Stories side panel (the `StorySheet` drawer opened from `QuoteStoriesTable`), let editors edit **Story Name, Description, Hours, and Cost**, and **delete** the story.

Today `StorySheet` already supports inline-saved edits for Status, Priority, Hours, Hours worked, and Assignees. It does not edit Name, Description, or Cost (Airtable `Invoice`), and has no delete. The underlying mutation layer (`lib/mutations/story.ts`) also lacks those field patches and any delete action.

## Changes

### 1. `lib/mutations/story.ts`
- Extend `StoryPatch` with `name?: string`, `description?: string`, `invoice?: number | null` (Airtable field = `Invoice`, surfaced as "Cost" in UI).
- Extend `buildStoryFields` to map those onto `"Story Name"`, `"Description"`, `"Invoice"`.
- Add new server action `deleteStory(storyId)`:
  - `requireRole("admin","lead","editor")` via existing `gate()`.
  - DELETE `https://api.airtable.com/v0/{baseId}/{Stories.id}/{storyId}` (add a small `deleteRecord` helper in `lib/airtable.ts` — single DELETE, same auth/error pattern as `getRecord`).
  - Call `invalidateStoryCaches()` and also `revalidateTag("pipeline:quotes")` (the tag used for quote reads — confirm in `lib/quotes.ts`; fall back to umbrella `airtable` if name differs).
  - Return `{ ok: true } | { error }`.

### 2. `components/engineering/StorySheet.tsx`
- Add optional props `onDeleted?: (id: string) => void` and `canDelete?: boolean` (defaults to `canEdit`).
- Replace the static header title with an inline-editable Name input (same blur-to-save pattern as Hours), only when `canEdit`.
- Add a new editable **Description** Field above Status — `<textarea>`, blur-to-save, only when `canEdit`. Keep the read-only Description block in the Context section for non-editors; hide it when the editable one is shown to avoid duplication.
- Add a new editable **Cost (USD)** Field next to Hours — number input, blur-to-save, maps to `invoice`.
- Hours editing already exists — no change.
- Add a **Delete story** button in the action row at the bottom (red, with a `confirm()` guard). On success: call `onDeleted?.(story.id)` then `onClose()`. Show inline error on failure.

### 3. `components/pipeline/QuoteSheetEditor.tsx`
- When rendering `StorySheet` for the quote drawer, pass `onDeleted={() => { setOpenStoryId(null); loadQuoteDetail(); }}` (or whatever the existing reload hook is) so the row disappears and totals recompute. Keep `canEdit` wiring as-is.

### 4. No changes needed to
- `QuoteStoriesTable.tsx` — it just lists rows and opens the sheet.
- Engineering board callers — new props are optional and default to safe values, so behavior there is unchanged (no delete button shown unless `canDelete` is passed).

## Technical notes

- Airtable field for "Cost" on Stories is `Invoice` (currency). Existing `createStory` uses the same mapping.
- `Hours Worked`, `Status`, `Priority`, assignees stay editable as today — user only asked for the four fields + delete, but removing existing edits would be a regression, so we leave them.
- Delete is destructive: confirm dialog + role gate on the server. Cache invalidation must hit both engineering (`engineering:stories`) and pipeline quote reads so the row vanishes from the quote totals immediately.
