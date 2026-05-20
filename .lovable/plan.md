## Goal

Tighten the Story drawer (`components/engineering/StorySheet.tsx`) so it (a) lets us edit **Hours Worked**, (b) shows client and quote names instead of record IDs, and (c) drops all $-cost framing in favor of hours.

## Changes

### 1. Make `Hours Worked` editable in the drawer

- `lib/mutations/story.ts` — extend `StoryPatch` with `hoursWorked?: number | null`; map it to Airtable field `"Hours Worked"` in `buildStoryFields`. No schema/field-ID changes (field already in `lib/schema.ts`: `Stories."Hours Worked"`).
- `StorySheet.tsx` — add a new editable `Field label="Hours worked"` right next to "Hours (scoped)", same `<input type="number" step="0.5">` pattern, using the existing `save()` helper. Updates flow through `updateStory` → `revalidateTag("airtable")`, so the Capacity Panel and card progress bars refresh automatically.

### 2. Show real Client name (not "(client)" placeholder)

Today `lib/engineering.ts` resolves `Story.Client` recIds against `peopleMap`, but `Client` links to **Companies**, not People — so it currently falls back to the literal string `"(client)"`. Switch to the existing **Stories.`Client (from Epic)`** lookup field, which already returns the client display names — no extra table fetch required.

- `lib/engineering.ts` — read `Tables.Stories.fields["Client (from Epic)"].id` in the `fields` array, and set `clientNames = asArray<string>(f["Client (from Epic)"])`. Keep `clientIds` from `Client` (still needed for the "All for {client}" filter button to keep working off recIds).
- No type changes needed (`Story.clientNames: string[]` already exists).

> Note: the user referenced a field literally named "Client Name". Stories doesn't expose one — the lookup that surfaces the client's display name on a Story is `Client (from Epic)`. If a different field is intended, swap the field name in one line.

### 3. Show Quote **name** instead of recId in the linked-quote link

The `quoteMap` built in `lib/engineering.ts` already produces `"Company · Project Name"` labels per quote and is stored on `story.quoteLabels[]` — drawer just isn't using it yet.

- `StorySheet.tsx` — in the "Linked Quote" block, render `current.quoteLabels[i] ?? q` as the link text instead of the raw recId `q`. Keep the existing `airvues-quote.vercel.app/?quoteId=…` URL unchanged.

### 4. Remove all $/cost framing from the drawer

- `StorySheet.tsx`:
  - Delete the `fmtMoney` helper and its import sites.
  - Replace the big "Story value · $X" hero block with an **Hours-focused header**: "Hours scoped" as the large number, with "Hours worked" + "Status" as the secondary row.
  - Delete the `<Field label="Cost">{fmtMoney(current.cost)}</Field>` row.
  - Leave `Budget % Used` (it's already a percentage, not money).

No changes to `Story` type, `lib/engineering.ts` totals, or any other surface — `/me` and `/money` keep their commission/$ display as before.

## Files touched

- `lib/mutations/story.ts` — add `hoursWorked` to `StoryPatch` + field mapping
- `lib/engineering.ts` — fetch + map `Client (from Epic)` lookup for `clientNames`
- `components/engineering/StorySheet.tsx` — editable Hours Worked field, hours-first hero, quote names in link, drop Cost row + `fmtMoney`

## Out of scope

- Capacity Panel / StoryCard styling (already hour-based)
- Per-engineer commission rates
- Removing `Story.cost` / `Story.invoice` from the type or other pages
