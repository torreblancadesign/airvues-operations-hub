## Goal
Exclude `On Hold` stories from the entire Engineering page so they don't inflate the Unassigned box or any other count.

## Why
`On Hold` in this base means "still in proposal, not yet a sale." These stories aren't real engineering work and shouldn't pollute orphan counts, engineer rollups, leaderboards, or status filters.

## Change
Single edit in `lib/engineering.ts` — treat `On Hold` the same as `Archived` (skip at ingestion).

```ts
// lib/engineering.ts
for (const story of stories) {
  if (story.status === "Archived" || story.status === "On Hold") continue;
  // ... rest unchanged
}

// and in tallyGlobal:
for (const s of stories) {
  if (s.status === "Archived" || s.status === "On Hold") continue;
  // ... rest unchanged
}
```

Because every downstream surface (Unassigned/orphan group, engineer groups, board totals, orphan triage at `/hygiene/orphans`, sprint rollups that reuse `getEngineeringBoard`) reads from this single data layer, one filter cleans them all.

## Side effects (intentional)
- `/hygiene/orphans` orphan count drops by however many on-hold unassigned stories existed — matches user's mental model (proposals aren't orphans).
- `/sprints` story counts won't include on-hold stories. Consistent with "don't count proposals."
- `On Hold` will disappear from the status filter dropdown on the Engineering board, since it's derived from visible stories.

## Out of scope
- Removing the `onHoldCount` field from `EngineerGroup.totals` (will just always be 0; cheaper to leave the field than ripple a type change).
- The `hold` bucket in `STATUS_GROUPS` (filter still parses, just won't match anything). Can prune later if you want.

## Verify
- Open `/engineering` → Unassigned card count drops; spot-check one previously-on-hold story is gone.
- Open `/hygiene/orphans` → orphan totals match.
- `npx tsc --noEmit` clean.
