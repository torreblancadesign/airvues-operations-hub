## Changes

**`components/pipeline/QuoteSheetEditor.tsx`**
- Remove the **Estimate Hours Range** `FieldRow` (lines 1235–1242) entirely.
- Replace the **Estimate Cost Range** `FieldRow` (lines 1244–1251) with a read-only display (plain text rendering of `quote.estimateCostRange`, or "—" when empty) — no `AiField`, no `onSave`. Keep the row label and PortalChip for visual consistency.
- Drop `estimateHoursRange` from the `aiContentReady` check in `CreateAiProposalRow` (lines 1167) so the AI completion gate no longer requires it. Keep `estimateCostRange` in the readiness check since the rollup will still populate.

**`lib/mutations/quote.ts`**
- Remove the two write lines (75–76) that PATCH `Estimate Hours Range` and `Estimate Cost Range` to Airtable, since the cost range is now a rollup (writes would 422) and hours range is no longer surfaced. Leaves the `QuoteFieldPatch` type alone — callers just stop sending these keys.

**Not changing**
- `lib/quotes.ts` continues to read both fields (cost range from the rollup, hours range harmlessly).
- `lib/quote-types.ts` types stay so other consumers don't break.
- `lib/schema.ts` field entries stay (read paths still use them).
