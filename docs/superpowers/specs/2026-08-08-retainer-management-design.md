# Retainer Management — Design

**Date:** 2026-08-08
**Status:** Approved, pending implementation
**Scope:** Internal ops tool only. The external client portal is out of scope.

## Problem

`/retainers` is read-only. Every retainer, every plan, and every SLA number has
to be typed directly into Airtable. That blocks the feature three ways:

1. **No retainer can be created from the app.** A retainer only exists if
   someone hand-builds a Quote row with `Proposal Type = "Retainer Agreement"`.
2. **No plan can be linked or re-linked.** `Retainer Tier` is set by hand, and
   there is no way to move a client from Gold to Platinum without opening the base.
3. **Custom plans have nowhere to live.** The tier table is a fixed catalog of
   seven names. A client on a negotiated rate with negotiated response times
   cannot be represented at all.

There is a fourth problem that makes the first three urgent: **every SLA column
in `⚙️ Retainer Tiers` is blank.** Only Platinum has a rate and hours; not one
tier defines a response time. So today every request resolves to `"Not covered"`
and the SLA engine, which is fully built and tested, measures nothing.

## Verified starting state

Read from the live base `app4vhhWMbRFOloOU` on 2026-08-08.

**`⚙️ Retainer Tiers` (`tblT6U9M9EFa4lKu0`) — 7 rows, all `Active`:**

| Tier | Rank | Monthly Rate | Included Hours | SLA columns |
|---|---|---|---|---|
| Bronze | 1 | — | — | all blank |
| Silver | 2 | — | — | all blank |
| Gold | 3 | — | — | all blank |
| Premium | 4 | — | — | all blank |
| Platinum | 5 | 6750 | 45 | all blank |
| Sapphire | 6 | — | — | all blank |
| Diamond | 7 | — | — | all blank |

**Retainer Agreement quotes (`tbldBIfAeRAunipbk`) — 3 rows:**

| Quote | Company | Tier link | Status | Subscription |
|---|---|---|---|---|
| Gracie Barra Retainer | Gracie Barra | Platinum | Approved and Signed | Active |
| `[ALWAYS ON] DR.BRONNER SYSTEM MANAGEMENT` | Dr. Bronner | — | **Rejected** | — |
| North London Therapy Practice — new proposal | North London | — | Project In Progress | — |

Only the first is a live retainer. The other two are a rejected quote and an
unsigned proposal, and both currently render on `/retainers` as if they were
live retainers under an SLA. That is a correctness bug in the board, fixed here.

## Decisions

Three forks were settled before design.

### D1 — A retainer stays a Quote

A retainer is a `⚪️ Quotes` row with `Proposal Type = "Retainer Agreement"`.
Ops CRUD writes to that row.

*Rejected alternative:* a dedicated `🟣 Retainers` table linked to Company, with
the quote as an optional source document. Cleaner separation of "the paper" from
"the live subscription", and it would give retainers their own lifecycle
independent of quote status — but it means migrating the read layer, the board,
the request join, and the one live record, and it leaves the external quote app
writing to a table the ops tool then has to reconcile. Not worth it for one live
retainer.

*Consequence accepted:* a retainer inherits ~90 proposal fields it does not use,
and "retainer is active" is expressed by `Retainer Subscription Active`, not by a
purpose-built status.

### D2 — A custom plan is a company-scoped row in the plan table

A custom plan is a real `⚙️ Retainer Tiers` row carrying a `Custom` flag and a
`Custom For` link to one Company. It defines the same fields as any catalog plan.
Every consumer of `RetainerTier` — `slaHoursFor`, `computeSlaDueAt`, the board —
works on it unchanged, because a plan is a plan.

*Rejected alternative:* per-retainer SLA override columns on the Quote. Keeps the
catalog clean, but makes the effective plan a merge of two records that you must
read in two places to understand, and adds four fields to an already-90-field table.

### D3 — The legacy plan field is mirrored only when the name matches

`Quotes` carries two plan fields: `Retainer Selected Tier` (a `singleSelect` of
the seven fixed names, written by the external quote app) and `Retainer Tier`
(the record link this feature uses). The signed Gracie Barra record has both.

It is not established whether the PandaDoc SOW or a quote-app automation renders
the legacy field into the client-facing document. So:

- The record link is **always** written.
- The legacy singleSelect is written **only** when the plan name is one of the
  seven known choices.
- For a custom plan there is no matching choice, so the legacy value is **left
  untouched, never blanked**. A stale name is recoverable by a human; a blank one
  silently breaks whatever renders the client's document.
- The detail UI warns when the two disagree.

## Architecture

### Schema — additive, two fields

On `⚙️ Retainer Tiers` (`tblT6U9M9EFa4lKu0`):

| Field | Type | Purpose |
|---|---|---|
| `Custom` | `checkbox` | true → excluded from the general catalog |
| `Custom For` | `multipleRecordLinks` → Companies | which client owns this plan |

`Quotes` already has `Company` (`fldes4pqblaFvJOHD`) and `Retainer Tier`
(`fldDaVIXgp5Q9eIwK`), so retainer CRUD needs **zero** new fields.

After the fields exist, `node scripts/regenerate-schema.mjs` refreshes
`lib/schema.ts`; `npm run verify-schema` must stay green.

### `lib/retainer-catalog.ts` — new, pure, no I/O

Sits beside `retainer-sla.ts` and `retainer-policy.ts` in the tested pure layer.
No `server-only`, no Airtable import, so it is unit-testable and client-safe.

```ts
/** Active catalog plans, then this company's active custom plans. Each by rank. */
plansAvailableFor(tiers: RetainerTier[], companyId: string | null): RetainerTier[]

/** The legacy singleSelect value for a plan name, or null for a custom plan. */
legacyTierChoiceFor(name: string): LegacyTierChoice | null

/** Field-level validation shared by create and update. */
validatePlanInput(input: PlanInput): string | null
```

`plansAvailableFor` excludes custom plans belonging to *other* companies. A
custom plan with no `Custom For` link is treated as belonging to nobody and is
hidden from every picker rather than leaked to all of them — the same
fail-closed rule `listRetainerAgreements` already applies to a missing Company.

`validatePlanInput` rejects: a blank name, a negative or non-finite rate or hours
value, a negative SLA value, and `custom: true` with no company.

### Type changes — `lib/retainer-types.ts`

`RetainerTier` gains two fields:

```ts
custom: boolean;
customForCompanyId: string | null;
```

### Read layer — `lib/retainers.ts`

`listRetainerTiers` currently drops inactive plans and returns the rest by rank.
That filter moves out: it now returns **every** plan — active and inactive,
catalog and custom — reading the two new columns, still ranked.

The filter has to move, because dropping inactive plans at the read is wrong in
two directions. The board resolves a retainer's tier name out of this list, so
deactivating a plan would blank the name on every retainer still using it; and
`tierForRetainer` in `lib/mutations/retainer-request.ts` resolves the SLA from
this same list, so deactivating a plan would silently drop every request on it
to `"Not covered"`. A retainer sitting on a retired plan is still owed the
response time it was sold.

Scoping and active-filtering become the caller's job, in one place —
`plansAvailableFor`, which is what feeds the pickers. Display paths take the
full list. No other caller signature changes.

`listRetainerAgreements` is unchanged. `RetainerAgreement.subscriptionActive`
already exists and is what the board sections on.

### Mutations

Both new files follow the house pattern: `"use server"`, gate first, Airtable
writes only through `lib/airtable.ts`, `revalidateTag("airtable")` on success,
errors returned as `{ error }` rather than thrown.

**Authorization.** Management mutations are `requireRole("admin", "lead")`.
This is deliberately stricter than `lib/mutations/retainer-request.ts`, which
uses `requireSignedIn()` because clients must be able to file their own requests.
Nobody outside admin/lead may create a retainer or edit a plan's pricing or SLA.

**`lib/mutations/retainer.ts`**

```ts
createRetainer(input: {
  projectName: string;      // required
  companyId: string;        // required — the tenant key
  tierId?: string | null;
  monthlyRate?: number | null;
  includedHours?: number | null;
  termMonths?: number | null;
  effectiveDate?: string | null;   // ISO date
  active: boolean;
}): Promise<{ ok: true; id: string } | { error: string }>

updateRetainer(id: string, patch: Partial<…>): Promise<Result>
```

`createRetainer` always writes `Proposal Type = "Retainer Agreement"` and
requires `companyId` — a retainer with no Company is unscopable and would be
invisible to its own board row, so it is rejected at the boundary rather than
written and hidden.

Both own the D3 legacy mirror, funnelled through one private helper so the
policy exists in exactly one place:

```ts
function planFields(tier: RetainerTier | null): Record<string, unknown>
```

**`lib/mutations/retainer-tier.ts`**

```ts
createPlan(input: PlanInput): Promise<{ ok: true; id: string } | { error: string }>
updatePlan(id: string, patch: Partial<PlanInput>): Promise<Result>
setPlanActive(id: string, active: boolean): Promise<Result>
```

Plans are **never hard-deleted**. `setPlanActive(id, false)` removes a plan from
every picker while leaving live retainers pointing at a row that still resolves.

### SLA backfill on plan edit

Without this the feature is inert on delivery.

`SLA Due At` is stamped once at request creation and never recalculated. Every
SLA column is blank today, so every request filed before a manager fills the
table is stamped `null` and reads `"Not covered"` **permanently** — filling the
columns afterwards would not fix a single one.

So when `updatePlan` changes any of the four SLA hour columns, it recomputes
`SLA Due At` for affected requests:

- **In scope:** requests whose retainer links this plan, whose status is in
  `OPEN_REQUEST_STATUSES`, and which have no `First Responded At`.
- Recomputed from each request's own `Submitted At` and current
  `Client Priority`, via the existing `computeSlaDueAt`.
- `SLA Outcome` is re-evaluated through the existing `evaluateSlaOutcome`.
- **Out of scope:** answered requests and closed requests keep their historical
  outcome. A response that met a two-hour promise must not retroactively become
  a breach because the promise later tightened.

Reads inside this path are uncached (`{ fresh: true }`), matching the rule
already documented in `listRetainerTiers` and applied in
`lib/mutations/retainer-request.ts`: a stale plan read here writes a wrong
deadline that nothing later corrects.

### UI

**`/retainers/plans` — new page.** The plan catalog, and the page a manager
actually uses to make the SLA engine live. One row per plan: name, rank, monthly
rate, included hours, the four SLA windows, client-facing label, active toggle.
Inline editing. `New plan` creates a catalog plan; `New custom plan` additionally
takes a Company and sets `Custom`. Custom plans are visually separated from the
catalog and labelled with their client.

Registered in `lib/nav.ts` under the `delivery` group, added to
`ROUTE_PERMISSION` in `lib/permissions.ts` as `Delivery`, and guarded with
`await assertCanAccess("/retainers/plans")` at the top of the page. Nav hiding
is not a gate.

**`/retainers/[id]` — edit panel added.** Project name, company, plan picker,
monthly rate, included hours, initial term, effective date, subscription active.
The picker is fed by `plansAvailableFor(tiers, agreement.companyId)` plus an
inline *Create custom plan for this client* action. Selecting a plan prefills
rate and hours from it but leaves both editable, so the negotiated number always
wins over the catalog number. Shows the plan's four SLA windows as they will
apply, and a warning when `Retainer Selected Tier` disagrees with the linked plan.

**`/retainers` — board.** Gains a `New retainer` button, and splits rows into
**Active** and **Not active** on `subscriptionActive`. SLA health, the summary
stat cards, and the "no tier linked" count are computed over the Active section
only. This is what stops the rejected Dr. Bronner quote and the unsigned North
London proposal from being reported as retainers at risk.

All three surfaces take `canEdit` from `canMutate()` and render read-only for
anyone below admin/lead.

## Testing

No test suite existed before the retainer work; it now has 43 passing tests
across `retainer-sla`, `retainer-policy`, and `retainer-board`, run by
`npm test` (`node --import tsx --test tests/*.test.ts`).

**New — `tests/retainer-catalog.test.ts`:**

- `plansAvailableFor` returns catalog plans for a company with no custom plans
- includes that company's custom plans, catalog first, each group ranked
- excludes another company's custom plans
- excludes a custom plan with no `Custom For` link
- excludes inactive plans, catalog and custom alike
- returns catalog only when `companyId` is null
- `legacyTierChoiceFor` matches each of the seven names, and is case-exact
- `legacyTierChoiceFor` returns null for a custom plan name
- `validatePlanInput` rejects blank name, negative rate, negative hours,
  negative SLA, and custom-without-company; accepts a valid catalog plan and a
  valid custom plan

The SLA backfill rule is exercised through its pure inputs — which requests are
in scope is a filter over `RetainerRequest[]`, extracted as a pure
`requestsNeedingSlaRecompute(requests, retainerIds)` so it is testable without
Airtable:

- selects open, unanswered requests on matching retainers
- excludes answered requests
- excludes closed and declined requests
- excludes requests on retainers linked to a different plan

**Manual verification, in order:**

1. `npm test` — 43 existing plus the new file, all passing
2. `npx tsc --noEmit` — exit 0
3. `npm run build` — exit 0
4. `npm run verify-schema` — green after regenerating `lib/schema.ts`
5. Against the live base, with throwaway records deleted afterwards:
   fill Platinum's four SLA columns and confirm an open Gracie Barra request
   moves off `"Not covered"`; create a retainer; link a plan; change the plan;
   create a custom plan for one company and confirm it appears in that client's
   picker and in no other; deactivate a plan and confirm live retainers still
   render its name.

## Out of scope

- The external client portal, its login, and request submission by clients.
- Retainer renewal, pause, and cancellation workflows. `Retainer Subscription
  Active` is a two-value select today and stays that way.
- Backfilling `Company` on retainer quotes that lack it.
- Reconciling the legacy `Retainer Selected Tier` on existing records.
- Per-retainer SLA overrides — superseded by D2.
- Notifications when a plan changes.

## Delivery

Two plans, in order. The first is independently shippable and is what unblocks
the manager.

- **Plan A — Plan catalog:** schema fields, `retainer-catalog.ts` + tests, type
  and read-layer changes, `retainer-tier.ts` mutations with SLA backfill,
  `/retainers/plans`.
- **Plan B — Retainer CRUD:** `retainer.ts` mutations, the `/retainers/[id]`
  edit panel, the `New retainer` flow, and board sectioning.
