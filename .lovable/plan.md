## Goal
Apply the same two improvements we made on `/engineering` to `/backlog`:

1. Show **full names** instead of first-name-only in assignee pickers.
2. Only show **active internal team members** as assignable (Thao etc. should not appear as "Assign to…" options).

Keep the filter dropdown unchanged — it should still let you filter by anyone who currently has open stories (including inactive people like Thao).

## Why it's broken today

`app/(app)/backlog/page.tsx` builds a single `engineers` list from `data.groups` (everyone with a story, regardless of `People.Status`) and passes it to **all four** consumers:
- `BacklogList` filter dropdown
- `StorySheet` assignee picker
- `BulkBar` "Assign to…" select
- `NewStoryModal` assignee chips

That defeats the active-person filter for the three "assign-to" surfaces. It also still renders first-name-only chips in `NewStoryModal` (line 223 — same bug we just fixed on the engineering page).

## Changes

### 1. `app/(app)/backlog/page.tsx`
- Stop deriving a single `engineers` list from `data.groups`. Instead build two lists, mirroring `EngineeringBoard.tsx`:
  - `engineersWithWork` — from `data.groups` (non-orphan), used for the FilterBar dropdown only.
  - `assignableEngineers` — from `data.assignablePeople` (already filtered to active internal in `lib/engineering.ts`), sorted by name. Used everywhere a person can be assigned.
- Pass both into `BacklogList` as separate props.

### 2. `components/backlog/BacklogList.tsx`
- Accept `engineersWithWork` and `assignableEngineers` instead of one `engineers` prop.
- Filter-bar engineer `<select>` uses `engineersWithWork` (unchanged behavior).
- `BulkBar` receives `assignableEngineers`.
- `StorySheet` receives `assignableEngineers`.
- `NewStoryModal` receives `assignableEngineers`.

### 3. `components/backlog/NewStoryModal.tsx`
- Line 223: `{e.name.split(" ")[0]}` → `{e.name}` so the assignee chips show full names (matches the StorySheet fix).

### 4. No changes needed in
- `BulkBar.tsx` — already renders `{eng.name}` in full.
- `StorySheet.tsx` — already fixed in the previous turn.
- `lib/engineering.ts` — `data.assignablePeople` already filters to active internal.

## Out of scope
- The other 4 pages using StorySheet (sprints kanban, sprint plan, /me, orphans) — same pattern, but each constructs its own engineer list and will need its own pass. Say the word and I'll extend it.
- Inactive-but-currently-assigned people remain editable: their chip still renders with × in StorySheet/bulk paths; they just can't be newly added.

## Verification
- `/backlog` filter "engineer" dropdown still lists Thao while she has open stories.
- Open a story → picker shows full names; Thao not in the "+ Add" list.
- Bulk-select rows → "Assign to…" select shows full names of active people only.
- "New Story" modal → assignee chips show full names; Thao not in the list.
- Existing assignments to Thao still render with a removable × chip.
