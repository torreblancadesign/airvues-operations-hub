## Goal

Fix undercounted "Lifetime Paid" on the Team page by joining payments to People via the linked-record lookup `Internal Team Member Account (from Link to Expenses)` instead of `Payee.email`.

## Why

The Payee field is an Airtable "user" field tied to a workspace login — its email often doesn't match `People.Primary Email` (personal Gmail vs work address, casing, contractors with no workspace seat). The lookup field returns the actual People record ID, which is the authoritative join.

## Changes — `lib/team.ts` only

1. **Add the lookup field to the payments fetch**, and add `Link to Expenses` so we have the raw link too (useful for debugging/fallback):
   - `Tables.TeamTaskPayments.fields["Internal Team Member Account (from Link to Expenses)"].id` → `fldkZAtaG66iN4Suj`
   - `Tables.TeamTaskPayments.fields["Link to Expenses"].id`

2. **Aggregate by People recId** (not email):
   ```ts
   const paidById = new Map<string, number>();
   const owedById = new Map<string, number>();
   for (const p of payments) {
     const lookup = p.fields["Internal Team Member Account (from Link to Expenses)"] as string[] | undefined;
     const personId = lookup?.[0]; // lookup returns array of recIds
     if (!personId) continue;
     const amt = (p.fields.Amount as number) ?? 0;
     if (p.fields.Status === "Paid") paidById.set(personId, (paidById.get(personId) ?? 0) + amt);
     if (p.fields.Status === "Needs Payment") owedById.set(personId, (owedById.get(personId) ?? 0) + amt);
   }
   ```

3. **Member mapping** now uses `p.id` (People recId) for the join:
   ```ts
   totalPaid: paidById.get(p.id) ?? 0,
   needsPayment: owedById.get(p.id) ?? 0,
   ```

4. **Payment enrichment** (the `payments` list shown in the page) — also surface the resolved personId so the UI can group/link reliably. Add `personId: string | null` to the `Payment` type, populated from the same lookup. (Keep `payeeEmail`/`payeeName` for display — only the *join* changes.)

5. **Drop the email-based maps entirely** — no fallback. Per CLAUDE.md the lookup is the authoritative link; payments missing it are a data-hygiene issue, not something to paper over.

## Out of scope

- No Airvues exclusion (confirmed earlier).
- No UI changes in `TeamDashboard.tsx` — it keeps reading `member.totalPaid` / `member.needsPayment`.
- No changes to the top-line "Lifetime paid out" KPI (it sums all Paid rows, unaffected).

## Verification

- `npx tsc --noEmit`
- Spot-check a member previously showing $0 (e.g. one with a personal Gmail) — should now show real total.
- Confirm sum of per-member `totalPaid` is ≤ the KPI total (difference = payments with no linked People record, which is the hygiene tail).
