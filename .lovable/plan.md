## Goal

Two tightly-scoped changes to the Pipeline quote drawer:

1. Replace the green "Client visible 👁" chip with the same "🖥️ Portal visible" chip used by the AI section, so every field that ends up in the client-facing proposal carries a single, consistent label.
2. Let users click a row in the quote calculator's Stories table to open the existing StorySheet drawer (the same one used on `/engineering`, `/backlog`, `/sprints`, etc.) for full detail view + inline editing.

No backend / data shape changes.

## 1. Standardize visibility chips

In `components/pipeline/QuoteSheetEditor.tsx`:

- Delete `ClientVisibleChip()` (lines ~41–50).
- Replace every `<ClientVisibleChip />` usage (the Section header + each `FieldRow` chip in "Quote details") with `<PortalChip />`.
- Keep `InternalChip` and `PortalChip` as-is. Result: "Quote details" + "AI-generated proposal content" both display the blue 🖥️ Portal visible chip; "Client input for proposal" keeps the amber 🔒 Internal only chip.

## 2. Click-to-open Stories from the quote calculator

Reuse the existing `components/engineering/StorySheet.tsx` drawer — that's the canonical story editor (status, priority, hours, assignee, notes, etc., all gated by `canEdit`).

### Data: fetch a full Story by id

Add `getStoryById(storyId)` to `lib/engineering.ts` (server-only). It returns the same `Story` shape already produced by the engineering board loader for one record — pull the existing field-mapping code into a small helper so both the list loader and `getStoryById` share it. Cache tag: `story:${id}` + the existing `airtable` umbrella tag.

### Wiring on the client

- `components/pipeline/QuoteStoriesTable.tsx`
  - Add `onRowClick(storyId: string)` prop.
  - Make each `<tr>` clickable (cursor-pointer + hover row tint + role="button" + keyboard Enter handler). The "+ Add story" button keeps its own handler.
- `components/pipeline/QuoteSheetEditor.tsx`
  - New state: `selectedStoryId: string | null`, `selectedStory: Story | null`, plus a small loading flag.
  - On row click, call a thin client-side server action wrapper (`loadStory(storyId)` in `lib/mutations/quote.ts` or new `lib/mutations/story-fetch.ts`) that internally calls `getStoryById`. Stash result in state.
  - Render `<StorySheet story={selectedStory} engineers={people} canEdit={canEdit} onClose={() => setSelectedStoryId(null)} onFilterByEngineer={() => {}} onFilterByClient={() => {}} />`. The two filter callbacks are no-ops here (Pipeline has no engineer/client filter to seed).
  - On StorySheet close, re-fetch the parent quote (existing `revalidateTag("quote:${id}")` already runs when StorySheet's `updateStory` mutation completes — it revalidates `airtable`). Add `quote:${quoteId}` revalidation to `updateStory`'s revalidate list **only if** the story belongs to a quote — simpler alternative: in `QuoteSheetEditor`, after the StorySheet closes, call an existing `refresh()`/`router.refresh()` so the Stories table + Total Cost re-pull.

- `app/(app)/pipeline/page.tsx` — no change. `people` is already passed through.

### Permissions

`StorySheet` already respects `canEdit`. Pass the same `canEdit` already in scope on `QuoteSheetEditor`. No new role checks needed; existing `updateStory` in `lib/mutations/story.ts` gates on `requireRole`.

## Out of scope

- Removing/unlinking a story from a quote (still create-only from this view).
- Changing the StorySheet UI itself.
- Inline editing of rows in the table without opening the drawer (drawer is the editor).
- Renaming AI-section subtitle suffixes like "(Portal Visible 🖥️)" inside field labels — the chip replacement is the single visual change requested.

## Files changed

- `components/pipeline/QuoteSheetEditor.tsx` — drop `ClientVisibleChip`, swap chip usages, mount `StorySheet`, wire row-click + load.
- `components/pipeline/QuoteStoriesTable.tsx` — add `onRowClick` + clickable rows.
- `lib/engineering.ts` — export `getStoryById` (extract shared row→Story mapper).
- `lib/mutations/quote.ts` (or small new file) — `loadStoryForQuote(storyId)` server action wrapper if needed for client invocation.
