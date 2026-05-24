## Goal

Make the Founder Dashboard per-founder by reading two values from Airtable's People table for the signed-in user:
- `Retirement Number` — the founder's annual earnings target (currently hardcoded as $115K/mo = ~$1.38M/yr)
- `Ownership Percentage` — the founder's share of monthly profit (currently hardcoded at 60%)

Retirement Number becomes editable inline on the dashboard (saves to Airtable). Ownership Percentage is read-only display.

## Changes

### 1. `lib/founder.ts` (new, server-only)
- `getFounderProfile()` — resolves the signed-in user via `resolvePersonByEmail` (already used by `/me`), then fetches their People record fields `Retirement Number` and `Ownership Percentage`.
- Returns `{ personId, name, retirementNumber: number | null, ownershipPercentage: number | null }`.
- Normalizes ownership the same way `lib/scorecard.ts` normalizes commission (`> 1 ? /100 : value`) so Airtable percent fields work whether stored as `0.6` or `60`.
- Cache tag: `["founder:profile"]`.

### 2. `lib/mutations/founder.ts` (new)
- `updateRetirementNumber({ personId, value })` server action.
- Gates with `requireRole("admin")` plus a self-check (signed-in email must resolve to `personId`) — same pattern as `lib/mutations/person.ts::updateAnnualEarningsGoal`.
- `patchRecords(Tables.People.id, [{ id, fields: { "Retirement Number": value } }])`.
- `revalidateTag("airtable")` + `revalidateTag("founder:profile")`.

### 3. `app/(app)/founder/page.tsx`
- After the existing `requireRole("admin")` gate, call `getFounderProfile()`.
- Pass `retirementNumber`, `ownershipPercentage`, `personId`, and a `canEdit` flag (self) into `<FounderDashboard />`.
- If `retirementNumber` is null → fall back to current default ($115K/mo × 12) and show an empty editor.
- If `ownershipPercentage` is null → fall back to `DEFAULT_ASSUMPTIONS.founderOwnership` (0.6) with a small "default — set in Airtable" hint.

### 4. `components/founder/FounderDashboard.tsx`
- Accept new props: `personId`, `retirementAnnual: number | null`, `ownershipPercentage: number | null`, `ownershipSource: "airtable" | "default"`, `canEdit: boolean`.
- Seed `monthlyGoal` from `retirementAnnual / 12` and `founderOwnership` from `ownershipPercentage` when present.
- In the Hero "Monthly goal" tile, when `canEdit` show a small "Edit retirement #" affordance that opens an inline editor (annual dollar input) calling `updateRetirementNumber`. Optimistic update + `router.refresh()` — mirrors `components/me/GoalEditor.tsx`.
- In the Assumptions panel:
  - Remove the editable "Monthly revenue goal" and "Founder ownership" inputs (they're now driven by Airtable).
  - Add two read-only rows showing the values + their source (Airtable / default).
  - Keep the other assumptions (commissions, fixed cost, overhead, payroll tax) as local-only knobs — same as today.

### Out of scope
- No multi-founder comparison view; the page shows the signed-in founder's numbers only.
- No edits to `Ownership Percentage` from the UI (per request).
- No changes to `lib/founder-math.ts` — all math stays pure; only the seed values change.
- No regeneration of `lib/schema.ts`; the two new fields are passed by name (same approach already used for `Annual Earnings Goal` in `lib/scorecard.ts`).

## Open question

The dashboard is currently behind `requireRole("admin")`. If a non-founder admin (e.g. a lead later promoted) opens it, there's no People record with these fields. The plan falls back to defaults and disables the edit button in that case. Confirm that's acceptable, or specify which People should be treated as "founders" (e.g. a `Role = "Founder"` check) and what to show otherwise.