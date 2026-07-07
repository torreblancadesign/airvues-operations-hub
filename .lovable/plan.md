## Fix: inline story edits revert after ~1s

### Root cause

The revert is a client-side state clobber, not an Airtable read issue.

1. `QuoteStoriesTable` keeps `localStories` and updates it optimistically inside `patchStory` (line 1233).
2. It also has a sync effect (line 1105) that resets `localStories = stories` whenever the `stories` prop changes.
3. The parent `QuoteSheetEditor` renders `<QuoteStoriesTable stories={quote.stories.filter(s => !s.isChangeOrder)} />` — the `.filter(...)` produces a **new array reference every render**.
4. Every server action (`updateStory` calls `revalidateTag("airtable")`) triggers Next.js's automatic RSC refresh, which causes `QuoteSheetEditor` to re-render. `quote` in local state hasn't changed, but the filtered array is a new reference → child effect fires → `localStories` gets reset to the pre-edit `quote.stories` → user sees the value snap back. A hard refresh reads fresh Airtable data and shows the persisted change.

`patchStory` also never propagates the edit up to the parent's `quote` state, so the parent's copy stays stale until `closeStory` / drawer reload runs.

### Fix

Two small changes, presentation-only:

1. **`components/pipeline/QuoteSheetEditor.tsx`** — memoize the two filtered arrays passed into `QuoteStoriesTable` so their references are stable across renders:
   ```ts
   const originalStories = useMemo(
     () => quote?.stories.filter(s => !s.isChangeOrder) ?? [],
     [quote?.stories],
   );
   const changeOrderStories = useMemo(
     () => quote?.stories.filter(s => s.isChangeOrder) ?? [],
     [quote?.stories],
   );
   ```
   Use these at lines 1253 and 1339. Now the `stories` prop reference only changes when `quote.stories` itself changes.

2. **`components/pipeline/QuoteStoriesTable.tsx`** — make the sync effect content-aware instead of reference-aware, as a belt-and-suspenders guard. Replace the current `useEffect(() => { setLocalStories(stories); ... }, [stories])` at line 1105 with a signature-based check (join of ids + a hash of the mutable fields), so an incoming prop that is deep-equal to `localStories` doesn't overwrite optimistic state. The selection-pruning block stays.

Optionally (nice-to-have, keeps parent totals fresh without a refetch): after `updateStory` succeeds in `patchStory`, call the existing `onChanged?` prop with a locally patched `QuoteDetail` so header totals and the parent's `quote.stories` stay aligned with what the user sees. Not required to fix the revert — the two changes above are sufficient.

### Verification

- Edit hours, status, tags, completed date, name on a retainer story → value stays put, no snap-back.
- Refresh page → same value persists (already working).
- Drag-reorder still works (uses `commitReorder`, unaffected).
- Change-order table on same quote still reflects edits identically.
- `npx tsc --noEmit` clean.
