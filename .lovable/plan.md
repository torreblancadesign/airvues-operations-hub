## Decision

All Airvues users see all recordings. Owner stays tagged on each row; a Creator filter helps people scope the list.

## Changes

### 1. `app/(app)/loops/page.tsx` — drop the role split

- Remove the `canMutate()` branch.
- Always call `listAllLoops()`.
- Drop the now-unused imports (`getAppSession`, `resolvePersonByEmail`, `canMutate`, `listLoopsForOwner`).

Engineers/contractors will now see everyone's recordings, same as admins.

### 2. `components/loops/LoopsBrowser.tsx` — add Creator filter

- Derive `ownerOptions` from loaded loops (distinct `{ id: ownerId, label: ownerName }` pairs), sorted by label.
- Add `ownerFilter` state: `"any" | "untagged" | <ownerId>`.
- Render the `<select>` unconditionally (everyone sees all recordings now, so it's always useful).
- Extend the filter predicate to honor `ownerFilter`.
- Include `ownerFilter` in `hasFilter` and the "Clear" reset.

### 3. Promote owner visibility on each card

Replace the plain-text owner in the card footer with a small "BY {name}" mono-caps chip, matching the existing Client/Quote chip family, so the creator is obvious at a glance.

### 4. Subtle ownership cue

Add a faint emerald accent ring on cards owned by the signed-in viewer (resolve viewer's personId server-side in `page.tsx` and pass to `LoopsBrowser` as `viewerOwnerId`). Purely visual — helps you spot your own recordings in a shared feed without forcing a filter.

## Files touched

- `app/(app)/loops/page.tsx` — universal `listAllLoops()`, pass `viewerOwnerId` down.
- `components/loops/LoopsBrowser.tsx` — Creator filter, by-chip, viewer-owned ring.

## Out of scope

- Server-side filtering / pagination.
- Reassigning ownership.
- The share-by-link `/r/[token]` flow (already public, untouched).
- The mutation gate in `lib/mutations/loop.ts` (still requires admin/lead/editor/engineer to record/edit — viewing is now open to all signed-in users, creating still gated).

## Verification

- Any signed-in user → sees the full grid.
- Creator dropdown lists every distinct owner; selecting one narrows the grid.
- Cards owned by the viewer show a subtle emerald edge.
- "Clear" resets all four filters.
- `npx tsc --noEmit` + `npm run build` clean.
