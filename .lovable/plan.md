## Problem

On `/engineering` (and anywhere `StorySheet` is opened from it), the "Assignee" picker only lists people who already have at least one active story. Internal engineers with no current assignments — or whose only stories are Archived/On Hold — never appear, so you can't assign work to them from the UI.

Root cause: `EngineeringBoard.tsx` derives the `engineers` prop from `data.groups`, and `data.groups` in `lib/engineering.ts` is built by walking active stories. The full People table is already fetched but only used for name lookups.

## Fix

Surface the full set of **assignable internal people** from the data layer, independent of story assignments, and pass it through to the picker.

### 1. `lib/engineering-types.ts`
Add a new client-safe type and field on `EngineeringBoardData`:

```ts
export type AssignablePerson = {
  id: string;
  name: string;
  role: string | null;
  internalType: string | null;
};

export type EngineeringBoardData = {
  groups: EngineerGroup[];
  assignablePeople: AssignablePerson[]; // NEW
  totals: { ... };
  clients: string[];
  sprints: { ... }[];
  statuses: string[];
};
```

### 2. `lib/engineering.ts`
After building `peopleMap`, derive `assignablePeople` from it:

- Include anyone with `Status === "Active"` AND `Type` ∈ {`"Internal"`, `"Internal team member"`} (mirrors the canonical-record tiebreakers already used in `lib/people.ts`).
- Exclude the `support@airvues.com` placeholder pattern if it slips in (defensive — `lib/people.ts` already filters it, but People records here come straight from Airtable, so guard by name/email if needed).
- Sort by name.
- Attach to the returned board as `assignablePeople`.

This is one extra `.filter().map().sort()` over data already in memory — no extra Airtable calls.

### 3. `components/engineering/EngineeringBoard.tsx`
Replace the `useMemo` that builds `engineers` from `data.groups` with one that uses `data.assignablePeople` (falling back to a union with currently-assigned people, so any one-off external assignees on existing stories don't disappear from the filter list).

Two consumers of `engineers`:
- `FilterBar` "All engineers" dropdown — should keep showing only engineers with stories in view, so pass the existing `data.groups`-derived list there (rename to `engineersWithWork`).
- `StorySheet` assignee picker — pass the new full `assignablePeople` list (rename prop usage to `engineers={assignablePeople}` or similar).

This split matches intent: filter by who has work, but assign to anyone who can do work.

### 4. Other call sites of `StorySheet`
`StorySheet` is mounted on 6 pages per `CLAUDE.md`. Quickly audit each (`backlog`, `sprints/[id]`, `sprints/[id]/plan`, `hygiene/orphans`, `me`, `engineering`) and make sure they pass the full assignable list, not a stories-derived subset. Where a page already fetches People (e.g. `lib/engineering.ts`), reuse it; where it doesn't, add a lightweight shared helper `listAssignablePeople()` in `lib/people.ts` (cached, tagged `people:assignable`) and call it from those page server components.

### 5. Verification
- `npx tsc --noEmit` and `npm run build` green.
- Open `/engineering`, click any story, confirm the assignee list now includes engineers who currently have zero stories.
- Confirm the FilterBar "All engineers" dropdown is unchanged (still only people with visible work).
- Confirm assigning a story to a previously-empty engineer creates a new group on next load.

## Out of scope
- No change to who counts as an "engineer" for commission/leaderboard math.
- No change to auth/role gating — write still requires `canMutate()`.
- No People-table dedupe work (still tracked separately per `CLAUDE.md`).
