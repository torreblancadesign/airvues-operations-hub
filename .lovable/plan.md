## Phase 2 — Companies editing + blueprint fields

Two-part change: (1) add the missing blueprint fields to the Airtable Companies table via the Meta API, (2) wire inline editing on `/clients/[id]` for both new and existing fields, plus contact (People) edit.

### Part 1 — Airtable schema additions (Companies table)

Using the Airtable connector + Meta API (`POST /v0/meta/bases/{baseId}/tables/{tableId}/fields`). Fields to create:

| Field name | Type | Options |
|---|---|---|
| `Industry` | singleSelect | SaaS, Marketplace, Fintech, Healthcare, E-commerce, Real Estate, Media, Other (editable later in Airtable) |
| `Lead Source` | singleSelect | Fiverr, Word of Mouth, Referral, Inbound, Outbound, Other |
| `Relationship Notes` | multilineText | — |
| `Discount %` | number (precision 2) | — |
| `Discount Reason` | singleSelect | Loyalty, Referral, Volume, Other |
| `Client Start Year` | number (precision 0) | — manual override; falls back to existing `Created` year if empty |

After creation I'll re-run `scripts/verify-schema.ts` and update `lib/schema.ts` with the new field IDs/names so everything stays canonical.

If any of these names already exist on the table, I'll reuse the existing field instead of duplicating.

### Part 2 — Code changes

**New: `lib/mutations/company.ts`** — single `updateCompany(args)` server action following the exact pattern in `lib/mutations/person.ts` and `lib/mutations/story.ts`:
- `requireRole("admin", "lead", "editor")` gate
- Validates `companyId` + per-field shapes (URL fields are validated, numbers checked finite/≥0)
- `patchRecords(Tables.Companies.id, [{id, fields}], { typecast: true })` so single-selects accept new values cleanly
- `revalidateTag("airtable")` + `revalidateTag("client-detail:companies")`
- Returns `{ ok: true } | { error }`

Editable fields exposed by the mutation:
- New: Industry, Lead Source, Relationship Notes, Discount %, Discount Reason, Client Start Year
- Existing: Website, Engagement Frequency (preserve `"Iddle"` spelling), Contract Type, Hourly Rate, Preferred Business, Has NDA?, Legal Address, Business Description, Drive Folder, Miro Folder, Google Chat

**Edit: `lib/client-detail.ts`** — surface the new fields on `ClientDetail` (Industry, leadSource, relationshipNotes, discountPct, discountReason, startYearOverride). `createdYear` already exists; add `clientStartYear = startYearOverride ?? createdYear`.

**Edit: `components/clients/ClientDetailView.tsx`**
- Replace static `<Field>` rows in the Overview panel with inline-editable controls (text input, select, textarea, number). Per-field commit on blur; optimistic update + revert on error. Same UX as `StorySheet`'s field editors.
- Replace the "No Relationship Notes field in Airtable yet" placeholder with an editable multiline textarea backed by the new field.
- Add an "Edit" affordance on each Contact row that opens an inline editor for Title, Email, Phone, Notes, Type, Status via a new `lib/mutations/person.ts` export `updateContact(personId, patch)` (extends the existing file, mirroring `updateAnnualEarningsGoal`'s auth pattern but gated on `canMutate` only — contact edits are not self-edits).
- All edit affordances hidden when `canEdit === false`.

**New small component: `components/clients/InlineField.tsx`** — generic controlled wrapper (label + editable input/select/textarea + saving spinner + error tooltip) so the Overview panel stays readable instead of repeating 12 inline state hooks.

### Out of scope (deferred to later phases)
- Adding/removing contacts (Phase 7 in the roadmap)
- Logo upload, `Created` year edit
- Project/invoice edits from the client page (those have their own sheets already)
- Airtable formula automation for Discount % auto-apply on quotes — manual capture only

### Verification
1. Meta API field-creation calls return 200 and the new field IDs are recorded.
2. `tsx scripts/verify-schema.ts` exits clean against the live base.
3. Build runs clean (handled automatically).
4. Load `/clients/[any-id]`, edit each new and existing field, refresh, confirm persistence.
5. Hit the page as a non-mutating role — verify all editors are read-only.

### Sequence when build mode opens
1. Connect/verify Airtable connector → `POST` 6 new fields to Companies table → capture IDs.
2. Update `lib/schema.ts` with new field IDs.
3. Add `lib/mutations/company.ts` + extend `lib/mutations/person.ts`.
4. Update `lib/client-detail.ts` to read new fields.
5. Add `InlineField.tsx` + rework Overview + Relationship Notes + Contacts editors in `ClientDetailView.tsx`.
6. Verify.
