## Goal
Two small fixes to the assignee picker on the engineering page (and the shared StorySheet drawer used on 6 pages):

1. Show **full names** instead of first-name-only.
2. Only show **active internal team members** as assignable — Thao (and anyone else inactive) should no longer appear as an option.

## Why Thao still appears today
`assignableEngineers` in `components/engineering/EngineeringBoard.tsx` is built as a **union** of:
- `data.assignablePeople` (filtered to `Status === "Active"` + Internal in `lib/engineering.ts`), AND
- `data.groups` (everyone with an active story, regardless of People.Status)

Thao is no longer Active, but she still has stories assigned to her, so the group-union step re-adds her. That defeats the active filter.

## Changes

### 1. `components/engineering/StorySheet.tsx`
- Line 412: change `+ {e.name.split(" ")[0]}` → `+ {e.name}` so the picker chips show full names (disambiguates two people with the same first name).
- Line 274: change `All for {current.assigneeNames[0]?.split(" ")[0]}` → `All for {current.assigneeNames[0]}` for consistency in the "filter by this engineer" link.

### 2. `components/engineering/EngineeringBoard.tsx`
- Replace the union logic in `assignableEngineers` (lines 60–70) so it is **only** `data.assignablePeople`, sorted by name. Drop the merge with `data.groups`.
- Stories already assigned to an inactive person (e.g. Thao) still render their chip with the × remove button — that path uses `current.assigneeIds`/`assigneeNames` directly in StorySheet and does not require the person to be in the `engineers` prop. So existing assignments remain editable (removable); they just can't be re-added once removed, which is the desired behavior for inactive people.
- `engineersWithWork` (used by the FilterBar dropdown) is unchanged — filtering by "engineers who have work" should still include Thao while she has open stories.

## Out of scope
- No changes to `lib/engineering.ts` — the `Status === "Active"` + Internal filter there is already correct.
- No changes to the other 5 pages mounting StorySheet in this pass (backlog, sprints kanban, sprint plan, /me, orphans). If you want the same fix applied there, say the word and I'll extend it — most of them pass their own engineer list shaped differently.
- No People-table dedupe or role gating work.

## Verification
- Open a story on `/engineering` → picker shows full names; Thao no longer appears as a "+ Add" option.
- Open a story currently assigned to Thao → her chip still renders with × so she can be removed.
- FilterBar "Engineer" dropdown still lists Thao while she has open stories (unchanged).
