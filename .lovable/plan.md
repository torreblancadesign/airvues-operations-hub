## Goal

Make Quote and Story drawers crash-proof against unexpected Airtable field shapes (Collaborator objects, broken formulas, null lookup values) so the UI degrades gracefully instead of erroring out.

## Root causes

**Quote #165 — React error #31 `object with keys {id, email, name}`**
That shape is an Airtable **Collaborator/User** field result. `lib/quotes.ts` and `lib/engineering.ts` assume linked-record fields like `Prepared by`, `Prepared for`, and the new `Epic Owner` return `string[]` of record IDs, but at least one of them is (or has been changed to) a User field, so the actual value is `[{id, email, name}, ...]`. The object then gets pushed through state and React eventually tries to render it (or React encounters it in a list/child position) and throws #31.

**Quote #160 — `Cannot read properties of null (reading 'toLowerCase')`**
Two likely sources:
- `components/engineering/StorySheet.tsx:51` — `payStatusTone(s)` calls `s.toLowerCase()` but `current.payStatus` (lookup field) can contain `null` entries.
- `components/pipeline/PersonPicker.tsx:29` — `o.name.toLowerCase()` assumes name is always a string, but `Full Name` is a formula that occasionally returns `null` or `{specialValue: "NaN"}` for misconfigured People rows.

Plus: `StorySheet` opened from the Quote drawer has **no error boundary**, so any render throw inside it crashes the whole drawer instead of showing a friendly fallback like the Quote does.

## Changes (frontend only, no business logic)

### 1. `lib/quotes.ts` — coerce linked/collaborator/lookup values

Add two helpers and use them everywhere we read linked-record-style fields:

```ts
// "recXX" string OR {id:"recXX"|"usrXX", email, name} collaborator object
function firstId(v: unknown): string | null { ... }
// Same but returns the full array
function asIdArray(v: unknown): string[] { ... }
```

Apply to: `Prepared by`, `Prepared for`, `Epic Owner`, `Stories` link, `Assignee` (story), and any other field we currently cast as `string[]`. This makes the loader tolerant of both schema shapes.

Also wrap every `(f["X"] as string) ?? null` for select/text fields with `asStr()` so a `{specialValue:"NaN"}` formula return doesn't poison state.

### 2. `lib/engineering.ts` — same hardening in `getStoryById`

Use the new `firstId` / `asIdArray` helpers for `Assignee`, `Client`, `Quote`, `📆Sprints`, `Epic Owner`. Coerce all name lookup arrays through a `asStringArray()` filter that drops non-strings, so `assigneeNames`, `clientNames`, `quoteLabels`, `epicOwnerNames`, `payStatus`, `sprintStatuses` are guaranteed `string[]`.

### 3. `components/engineering/StorySheet.tsx` — defensive render

- Change `payStatusTone(s: string)` to accept `string | null | undefined` and bail to default tone when falsy.
- Skip rendering null entries in the `payStatus.map(...)` loop.
- Default `current.clientNames[0]`, `assigneeNames[i]` etc. to string fallbacks before passing to handlers.

### 4. `components/pipeline/PersonPicker.tsx` — defensive search

- Use `(o.name ?? "").toLowerCase()` in the filter.
- Display fallback `"(no name)"` when `selected.name` is missing.

### 5. `components/pipeline/QuoteSheetEditor.tsx` — wrap StorySheet in an error boundary

Extract the existing `QuoteSheetErrorBoundary` from `QuoteSheet.tsx` into a small shared component (e.g. `components/pipeline/DrawerErrorBoundary.tsx`) and reuse it around the `<StorySheet ... />` render in `QuoteSheetEditor`. Failure → red "Story couldn't be rendered" card with "Open in Airtable" + "Close", same UX as the quote-level boundary, instead of unmounting the whole quote drawer.

## What does NOT change

Airtable schema, mutations, RLS/role gating, the AI proposal trigger, loops pipeline, or any data math. Pure presentation + loader-coercion hardening.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. Reopen quotes #165 and #160 in preview and click into stories — both should now render. If a field is still misshapen, the error boundary fallback shows up with a real message instead of a white-screen.

