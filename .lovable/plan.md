## Goal
Allow the "Prepared for" field on the project/quote page to hold multiple client contacts instead of just one.

## Changes

### 1. UI — `components/pipeline/QuoteSheetEditor.tsx`
Replace the single `PersonPicker` with a new multi-select picker on the "Prepared for" row. Selected people render as removable chips; a search-and-add dropdown below (same visual language as `PersonPicker`).

### 2. New component — `components/pipeline/MultiPersonPicker.tsx`
Small wrapper reusing the search/filter logic from `PersonPicker`. Props:
- `values: string[]`
- `options: PersonOption[]`
- `onChange: (ids: string[]) => void`
- `disabled`, `placeholder`

`PersonPicker` stays untouched (used elsewhere for single-select fields like Prepared by, Epic Owner).

### 3. Types — `lib/quote-types.ts`
- `QuoteDetail.preparedForId: string | null` → `preparedForIds: string[]`
- `QuoteFieldPatch.preparedForId?: string | null` → `preparedForIds?: string[]`

### 4. Loader — `lib/quotes.ts`
Return `preparedForIds: asStringArray(f["Prepared for"])` instead of `firstId(...)`.

### 5. Mutation — `lib/mutations/quote.ts`
- `buildQuoteFields`: `fields["Prepared for"] = patch.preparedForIds ?? []`
- Any other write path setting `Prepared for` (createQuote branch around line 529) updated to accept `preparedForIds: string[]`.

### 6. Ancillary read-side (no behavior change)
- `lib/pipeline.ts` already exposes `preparedForIds: string[]` — untouched.
- `/api/quote-sso` currently signs a token for `quote.primaryEmail` (the first email lookup returns from Airtable). With multiple Prepared for contacts, the "Web Quote ↗" button will SSO-authenticate as the **first** listed contact. This matches today's behavior when only one exists and is the least surprising default. Not changing SSO logic in this task.

## Verification
- `npx tsc --noEmit` clean
- `npm run build` clean
- Open a quote, add a second Prepared for, save, reload → both chips present; remove one → persists; Airtable record shows both linked People.

## Out of scope
- SSO-link picker to choose which contact the "Web Quote" link authenticates as (can add later if needed).
- Changing how `Client Name` / `primaryEmail` rollups display (Airtable-side, already array-aware).
