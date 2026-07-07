
## Add Tags to Retainer Stories

Adds a text-based `Tags` field to stories shown in retainer quotes, with autocomplete from existing tags, and sub-groups the month buckets by tag with per-tag story/hour totals.

### Data model

Tags stored as comma-separated text in Airtable's `Tags` field on `🟢 Stories` (matches your choice of text-not-single-select so new tags can be added freely). On read, split on `,` and trim; on write, join `["a","b"]` → `"a, b"`. Empty string → no tags → bucketed as "Untagged".

### Files touched

1. **`lib/schema.ts`** — add `"Tags": { id: "Tags", type: "singleLineText" }` under `Stories.fields`. Using the field name as the ID is the same escape hatch already used for `"Change Order"` and `"Completed Date"` in this table; swap in `fldXXX` once Airtable Meta API exposes it.

2. **`lib/quote-types.ts`** — add `tags: string[]` to `QuoteStoryRow`.

3. **`lib/quotes.ts`** — request the Tags field, map `sf["Tags"]` → `tags: string.split(",").map(trim).filter(Boolean)`.

4. **`lib/mutations/story.ts`** — extend `StoryPatch` with `tags?: string[]`; in `buildStoryFields`, write `fields["Tags"] = patch.tags.join(", ")`.

5. **`components/pipeline/QuoteStoriesTable.tsx`** — the retainer-only work:
   - Add a **Tags column** (visible only when `groupByMonth` is true, i.e. retainer mode — matches how Completed date is toggled today) between Hours and Completed. Renders each tag as a small pill. Inline editor is a chip input:
     - existing tags render as removable pills
     - a text input adds a new tag on Enter / comma / blur
     - a datalist (built from `allTagsInQuote` computed via `useMemo` over `localStories`) provides suggestions from tags already used in this quote
     - on change, calls `onPatch(id, { tags: [...] })` → `updateStory({ tags })`
   - **Sub-grouping inside months:** when `groupByMonth` is true, split each month group's stories by tag. A story with multiple tags appears under each of its tags (multi-tag membership); stories with no tags go to an "Untagged" sub-bucket. `monthGroups` becomes `{ key, label, stories, totalHours, tagGroups: { tag, stories, totalHours, totalCost }[] }`.
   - Sub-group header row (rendered inside `FragmentGroup`): tag name pill + `N stories` + `Xh` pill, indented under the month header. Sub-groups collapsible with the same `localStorage`-persisted pattern used for months (key: `qst:${quoteId}:collapsedTagGroups`, entries stored as `${monthKey}::${tag}`).
   - Optimistic patch: extend `patchStory` to accept `tags` and merge into `localStories`.
   - Table header adds a `Tags` `<th>` (only when `groupByMonth`), and `colSpan` on the month header row bumps from 10 → 11.
   - DnD: keep the existing rule (only reorder within same month); we do **not** additionally restrict by tag (tags are a view, not the sort key).

### Out of scope

- Filtering by tag / tag chip in the filter bar
- Bulk-tag action in `BulkBar`
- Applying tags to non-retainer stories (column is hidden outside retainer mode; the field still works if edited elsewhere)
- Renaming a tag across every story (would need a bulk rename utility)
