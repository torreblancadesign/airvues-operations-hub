
# Loops: sidebar icon, list tags + filters, edit links on detail

Four changes, no schema work (Airtable already has `Linked Client` / `Linked Quote`).

## 1. Sidebar icon

`components/Sidebar.tsx` — add an `IconLoop` SVG (play triangle inside a rounded square, matching the existing 14px stroke-2 set) and register `"/loops": <IconLoop />` in `ICONS`. Do the same in `components/MobileNav.tsx` (uses inline `I(...)` SVG factory).

## 2. Surface BOTH tags on Loop

Today `lib/loops.ts` collapses everything into one `linkKind` and only the client wins when both are set. Update so each loop carries both tags independently (keep `linkKind` for back-compat).

- `lib/loops-types.ts`: add `linkedClientId`, `linkedClientName`, `linkedQuoteId`, `linkedQuoteName` (all nullable). Leave existing `linkKind` / `linkedId` / `linkedLabel` untouched.
- `lib/loops.ts` `toLoop()`: populate the four new fields from `Linked Client` / `Linked Client Name` / `Linked Quote` / `Linked Quote Name`.

## 3. Loops list — display + filter

`app/(app)/loops/page.tsx` becomes a server shell that fetches loops and renders a new client component `components/loops/LoopsBrowser.tsx`.

**LoopsBrowser** (client):
- Top filter bar (sticky inside the card grid container):
  - Search input (matches title + owner)
  - Client `<select>` populated from the distinct `(linkedClientId, linkedClientName)` pairs present in the loaded loops, plus an "Any client" default and an "Untagged" option
  - Quote `<select>` same pattern
  - "Clear filters" link when any filter is active
- Result count line: "Showing N of M recordings"
- Each card gets two small chips beneath the title:
  - `Client · {name}` (emerald-tinted) when present
  - `Quote · {name}` (sky-tinted) when present
  - Nothing if both empty (keeps current visual density)
- Empty-state for "no matches" distinct from "no recordings yet"

Filtering happens client-side over the already-fetched list — pagination is out of scope; this is fine for current data volumes and matches how other lists in the app work.

## 4. Edit links on the detail page

Add a "Tags" card to `app/(app)/loops/[id]/page.tsx` showing current Client + Quote with an inline editor. Available to admins and to the loop owner (same rule as delete).

- New server action in `lib/mutations/loop.ts`:
  ```
  updateLoopLinks(id, { linkedClientId, linkedQuoteId }): LoopMutationResult
  ```
  - Gate: `requireRole("admin","lead","editor","engineer")` AND owner check (load the record, compare `Owner[0]` to caller's People id; admin/lead skip the owner check).
  - Patches `Linked Client` / `Linked Quote`. Empty string → clear field (`[]`).
  - Revalidates `loops` + `loops:id:{id}`.
- New client component `components/loops/LoopTagsEditor.tsx`:
  - Two `<select>`s prefilled with the loop's current values
  - "Save" button that calls the action; shows inline error / "Saved" confirmation
  - Compact, matches the existing share-link card styling
- Detail page server-fetches `listAllClients()` + `listQuoteOptions()` once and passes both to the editor.

## Out of scope

- Story / Lead linking (already deferred per earlier turn)
- Server-side pagination or Airtable-side filtering (client-side filter is enough for current scale)
- Public share page (`/r/[token]`) styling changes
- Bulk-edit tagging on the list page

## Files touched

- `components/Sidebar.tsx` — IconLoop + ICONS entry
- `components/MobileNav.tsx` — loop SVG + entry
- `lib/loops-types.ts` — add 4 fields to `Loop`
- `lib/loops.ts` — populate new fields in `toLoop()`
- `app/(app)/loops/page.tsx` — thin server shell
- `components/loops/LoopsBrowser.tsx` — NEW client component (filter + grid + chips)
- `lib/mutations/loop.ts` — `updateLoopLinks` action
- `components/loops/LoopTagsEditor.tsx` — NEW client editor
- `app/(app)/loops/[id]/page.tsx` — fetch client/quote options + render editor
