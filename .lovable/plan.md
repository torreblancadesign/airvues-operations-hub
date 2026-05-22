## Edit Annual Earnings Goal from /me scorecard

Let people set/update their `Annual Earnings Goal` directly from the scorecard page — no more "open it in Airtable" placeholder.

### Server Action (`lib/mutations/person.ts` — new file)

`updateAnnualEarningsGoal({ personId, goal })` where `goal` is a non-negative number or `null` (to clear).

Permission model — broader than `requireRole` because every engineer should manage their own goal:
- Allow when the caller's resolved People id (`resolvePersonByEmail(session.email)`) === `personId`. (User editing self.)
- OR caller is `admin` / `lead` via `canMutate()`. (Admins editing on behalf.)
- Reject otherwise with the same `AuthzError`-style `{ error }` envelope.

On success: `patchRecords(Tables.People.id, [{ id, fields: { "Annual Earnings Goal": goal } }])`, then `revalidateTag("airtable")` + `revalidateTag("scorecard:people-goals")`.

### UI (`components/me/PersonScorecard.tsx`)

Replace the current goal display block (both the GoalBar with goal set, and the dashed "Set an annual earnings goal" placeholder) with a unified component that includes inline edit:

- New `GoalEditor` subcomponent (client). Default view = the existing `GoalBar` (or empty-state card) with a small pencil/edit affordance in the top-right when `canEditGoal` is true.
- Click edit → swap label area for a compact form: number input (USD), Save / Cancel buttons, plus a "Clear goal" link when a goal exists.
- On save: call the server action, optimistically update local state, show small inline error if the action returns `{ error }`. After success the cached read revalidates and the page re-renders with the new value.

A new prop `canEditGoal: boolean` is passed in from the page:
- `true` when viewing your own scorecard (`engineerId === ownPersonId`) OR `canEdit` (admin/lead) is true.
- `false` otherwise (e.g. a scorecard-admin who isn't a lead viewing someone else — they can look but not edit).

`app/(app)/me/page.tsx` computes `canEditGoal = editable || engineerId === ownPersonId` and passes it through.

### Out of scope
- No changes to commission rate editing (separate field, still Airtable-only).
- No changes to other goal types — only Annual Earnings Goal.
- No UI for tracking goal history.
