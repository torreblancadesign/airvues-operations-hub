## Problem

The `/me` picker only lists people who currently have at least one (non-archived, non-on-hold) story assigned. It's built from `board.groups`, which is the grouping of *active stories by assignee* — not the roster of internal team members. Anyone without an active story (newer hires, BAs, people between sprints) silently disappears.

## Fix — `lib/scorecard.ts`

Build the `engineers` list from `board.assignablePeople` (already filtered to `Status === "Active"` AND `Type ∈ {Internal, Internal team member}` in `lib/engineering.ts:213-225`), not `board.groups`.

```ts
const engineers: ScorecardEngineer[] = board.assignablePeople.map((p) => ({
  id: p.id,
  name: p.name,
  role: p.role,
  internalType: p.internalType,
  isOrphan: false,
}));
```

That swap alone gives the picker the full active internal roster, alphabetically sorted (already done upstream).

The scorecard lookup itself still uses `board.groups.find(...)`, which is correct — but for an active member with zero stories the group won't exist and we'd fall through to `{ scorecard: null, ... }`, looking broken. So:

- When `engineerId` is provided and matches an `assignablePeople` entry but has no `board.groups` row, return an empty scorecard (zeros + empty story arrays) using their People metadata, instead of dropping back to the picker.

## Out of scope

- `PersonPicker.tsx` already filters `!e.isOrphan`; no change needed since the new list has no orphans.
- No changes to engineering board logic, types, or UI.

## Verification

- `npx tsc --noEmit`
- Open `/me`, confirm the dropdown lists every Active internal team member (compare against `/team`).
- Pick someone with no current stories — page renders zeros, doesn't crash or bounce.
