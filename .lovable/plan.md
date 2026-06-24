# Project drawer — multi-color sections + denser layout

Presentation-only refactor of `components/pipeline/QuoteSheetEditor.tsx` (plus a small wrap of `ProjectLogTimeline` on the project page). No data, mutation, or schema changes.

## 1. Use the shared `Section` primitive with distinct tones

Today the editor uses a local `Section` (lines 566–598) that hardcodes a green left rail on every block, so the whole drawer reads as one giant emerald section. Replace it with the shared `components/ui/Section.tsx` (already used on the Account page) and give each block its own color so the eye can tell them apart:

| Section in editor | Tone (left rail) | Default state |
|---|---|---|
| Quote details (project name → Blueprint engagement) | emerald | open |
| Client input for proposal | sky | collapsed |
| AI-generated proposal content | violet | collapsed |
| Quote calculator (stories table + totals) | amber | open |
| Change orders | red | collapsed |
| Project log (timeline) | neutral | collapsed |

The shared `Section` already supports `tone`, `storageKey`, `defaultOpen`, and `meta`. Persistence keys stay `qs:<quoteId>:<slug>` so existing user open/closed state is preserved.

Delete the local `Section` function in `QuoteSheetEditor.tsx` once all call sites are migrated.

## 2. Denser Quote details layout (responsive 2-col grid)

The current "Quote details" section stacks every field full-width via `FieldRow` (one field per row, ~720–880px wide). On desktop that wastes horizontal space. Change just this section to a responsive grid:

- mobile: single column (unchanged feel)
- ≥`md` (≥768px): `grid-cols-2` with `gap-x-5`
- full-width spans for the two long fields: **Project name** and **Blueprint engagement** (use `md:col-span-2`)
- everything else (Prepared by, Prepared date, Delivery due, Prepared for, Project status, Proposal type, Epic owner) sits in two columns

`FieldRow` keeps its label/chip/save-indicator layout; only its outer wrapper changes from "bordered row" to "grid cell" inside Quote details. I'll do this by giving `FieldRow` an optional `variant?: "row" | "cell"` prop — `cell` drops the bottom border + horizontal padding so it sits cleanly inside the grid. Other sections continue using the default `row` variant unchanged.

## 3. Zebra rows in the Quote calculator

The stories sub-table inside `QuoteStoriesTable` is the dense block in "Quote calculator". Apply the same alternating background already in use elsewhere:

- add `row-zebra` (utility already in `app/globals.css`) to the `<tbody>` of the stories table
- add `row-hover` for consistent hover feedback
- keep totals row visually distinct (existing top border + bold treatment)

If `QuoteStoriesTable` doesn't already expose a tbody className path, add the classes directly on the existing tbody element. No logic changes.

## 4. Project log as its own section on the project page

In `app/(app)/pipeline/[id]/page.tsx` the `<ProjectLogTimeline>` currently renders as a bare block under the editor card. Wrap it in the shared `Section` (tone `neutral`, `storageKey="qs:<id>:log"`, `defaultOpen={false}`, `meta={<>{entries.length} events</>}`) so it matches the visual language of the rest of the drawer.

`ProjectLogTimeline` itself is unchanged.

## 5. Verification

- `npx tsc --noEmit` clean
- `npm run build` clean
- Manual: open a quote drawer, confirm five differently-colored section rails, Quote details in 2 columns on ≥md, zebra rows in the calculator, log section collapsible. Confirm prior collapsed/expanded state still persists by storage key.

## Files touched

- `components/pipeline/QuoteSheetEditor.tsx` — swap local `Section` for shared, assign tones, refactor Quote details into responsive grid via new `FieldRow` `variant`, delete local `Section`
- `components/pipeline/QuoteStoriesTable.tsx` — add `row-zebra row-hover` to tbody
- `app/(app)/pipeline/[id]/page.tsx` — wrap `ProjectLogTimeline` in shared `Section`

No changes to `lib/`, mutations, or any data layer.
