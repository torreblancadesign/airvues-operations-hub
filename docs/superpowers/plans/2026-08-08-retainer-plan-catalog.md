# Retainer Plan Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give managers a page in the ops tool where they can define retainer plans — rate, included hours, and the four business-hour SLA windows — including custom plans scoped to a single client, and have existing open requests pick up newly-defined SLAs.

**Architecture:** Two additive Airtable fields turn `⚙️ Retainer Tiers` into a catalog that can also hold company-scoped custom plans. A new pure module, `lib/retainer-catalog.ts`, owns scoping and validation with no I/O so it is unit-tested. A new Server Action file, `lib/mutations/retainer-tier.ts`, owns writes and the SLA backfill. A new page, `/retainers/plans`, is the manager-facing surface.

**Tech Stack:** Next.js 14 App Router (Server Components + Server Actions), TypeScript strict, Tailwind, Airtable REST via `lib/airtable.ts`, `node:test` + `tsx` for tests.

**Spec:** `docs/superpowers/specs/2026-08-08-retainer-management-design.md`

**Branch:** `retainer-internal-surfaces`

## Global Constraints

- **Never import `lib/airtable.ts` from a client component.** It carries `"server-only"` and the `AIRTABLE_TOKEN`. Pass data down from Server Components.
- **Never call the Airtable REST API outside `lib/airtable.ts`.** The wrapper owns batching, rate limiting, and `typecast`.
- **Never hardcode a field ID.** Read every one from `lib/schema.ts`, e.g. `Tables.RetainerTiers.fields["Tier Name"].id`.
- **Every Server Action gates first.** `requireRole("admin", "lead")` for everything in this plan, before any read or write.
- **Every successful mutation calls `revalidateTag("airtable")`,** plus `revalidateTag("retainers:tiers")`.
- **A gated page is gated server-side.** Add the route to `ROUTE_PERMISSION` in `lib/permissions.ts` AND call `await assertCanAccess(href)` at the top of the page. Hiding it from the nav is not a gate.
- **Pure modules stay pure.** `lib/retainer-catalog.ts` must not import `lib/airtable.ts`, `lib/retainers.ts`, or anything carrying `"server-only"`, or every test in the suite fails to load.
- **`now` is always a parameter,** never `new Date()` inside a pure function.
- Table IDs: `⚙️ Retainer Tiers` = `tblT6U9M9EFa4lKu0`, `⚙️ Companies` = `tblQ3hxcIEUQPLN6f`, `⚪️ Quotes` = `tbldBIfAeRAunipbk`, `🟣 Retainer Requests` = `tblRBsPqSvzvAuSyY`.
- Verification gate for every commit: `npm test` → `npx tsc --noEmit`. The final task adds `npm run build` and `npm run verify-schema`.

---

### Task 1: Add the two schema fields and regenerate `lib/schema.ts`

Adds `Custom` and `Custom For` to `⚙️ Retainer Tiers`. Nothing else in the plan can reference these fields until they exist in the live base, because `lib/schema.ts` is generated from it.

**Files:**
- Create: `scripts/add-custom-plan-fields.mjs`
- Modify: `lib/schema.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: `Tables.RetainerTiers.fields["Custom"].id` and `Tables.RetainerTiers.fields["Custom For"].id` in `lib/schema.ts`.

- [ ] **Step 1: Write the one-shot field-creation script**

Create `scripts/add-custom-plan-fields.mjs`:

```js
// One-shot: adds Custom + Custom For to ⚙️ Retainer Tiers.
// Idempotent — skips a field that already exists. Safe to re-run.
// Run: set -a; . ./.env.local; set +a; node scripts/add-custom-plan-fields.mjs
const BASE = "app4vhhWMbRFOloOU";
const TIERS = "tblT6U9M9EFa4lKu0";
const COMPANIES = "tblQ3hxcIEUQPLN6f";
const TOKEN = process.env.AIRTABLE_TOKEN;

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN must be set. Run with --env-file=.env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function existingFieldNames() {
  const r = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, { headers });
  if (!r.ok) throw new Error(`Meta read failed (${r.status}): ${await r.text()}`);
  const { tables } = await r.json();
  const t = tables.find((x) => x.id === TIERS);
  if (!t) throw new Error(`Table ${TIERS} not found`);
  return new Set(t.fields.map((f) => f.name));
}

async function createField(body) {
  const r = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE}/tables/${TIERS}/fields`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  if (!r.ok) throw new Error(`Create ${body.name} failed (${r.status}): ${await r.text()}`);
  const f = await r.json();
  console.log(`created ${f.name} -> ${f.id}`);
}

const have = await existingFieldNames();

if (have.has("Custom")) {
  console.log("skip Custom (exists)");
} else {
  await createField({
    name: "Custom",
    type: "checkbox",
    description: "Checked = a negotiated plan for one client. Hidden from the general catalog.",
    options: { icon: "check", color: "purpleBright" },
  });
}

if (have.has("Custom For")) {
  console.log("skip Custom For (exists)");
} else {
  await createField({
    name: "Custom For",
    type: "multipleRecordLinks",
    description: "The single client this custom plan belongs to. Required when Custom is checked.",
    options: { linkedTableId: COMPANIES, prefersSingleRecordLink: true },
  });
}

console.log("done");
```

- [ ] **Step 2: Run it**

```bash
set -a; . ./.env.local; set +a; node scripts/add-custom-plan-fields.mjs
```

Expected: two `created … -> fld…` lines. Re-running prints two `skip` lines and changes nothing.

If it fails with `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`, the token lacks `schema.bases:write` on this base — stop and report, do not work around it.

- [ ] **Step 3: Regenerate the schema**

```bash
node scripts/regenerate-schema.mjs
```

Expected: reports 41 tables and a field count two higher than before (was 898).

- [ ] **Step 4: Confirm the new field IDs landed**

```bash
grep -A 20 'RetainerTiers: {' lib/schema.ts | grep -E '"Custom'
```

Expected: two lines, `"Custom": { id: "fld…", type: "checkbox" }` and `"Custom For": { id: "fld…", type: "multipleRecordLinks" }`.

- [ ] **Step 5: Verify the generated schema still matches the live base**

```bash
set -a; . ./.env.local; set +a; npm run verify-schema
```

Expected: `✅ Schema OK`.

- [ ] **Step 6: Commit**

```bash
git add scripts/add-custom-plan-fields.mjs lib/schema.ts
git commit -m "Add Custom and Custom For fields to the retainer plan table"
```

---

### Task 2: Carry `custom` / `customForCompanyId` on `RetainerTier`, and stop dropping inactive plans at the read

The active filter moves out of `listRetainerTiers` into the picker helper built in Task 3. Both the board and `tierForRetainer` in `lib/mutations/retainer-request.ts` resolve tiers out of this same list, so filtering here would blank the tier name on the board and silently drop every request on a retired plan to `"Not covered"`.

Adding two required fields to `RetainerTier` breaks the four existing tier literals in the test suite. This task fixes them — that is the compile-time proof that every construction site was found.

**Files:**
- Modify: `lib/retainer-types.ts` (the `RetainerTier` type)
- Modify: `lib/retainers.ts` (`listRetainerTiers`)
- Modify: `tests/retainer-policy.test.ts` (2 tier literals)
- Modify: `tests/retainer-board.test.ts` (2 tier literals)

**Interfaces:**
- Consumes: `Tables.RetainerTiers.fields["Custom"].id`, `…["Custom For"].id` from Task 1.
- Produces: `RetainerTier` with `custom: boolean` and `customForCompanyId: string | null`; `listRetainerTiers(opts?: { fresh?: boolean }): Promise<RetainerTier[]>` now returning inactive plans too, still rank-sorted.

- [ ] **Step 1: Confirm the tests are green before touching anything**

```bash
npm test
```

Expected: `pass 43`, `fail 0`. If not, stop — something upstream is broken.

- [ ] **Step 2: Add the two fields to the type**

In `lib/retainer-types.ts`, inside `RetainerTier`, after `active: boolean;`:

```ts
  /** True = a negotiated plan for one client, hidden from the general catalog. */
  custom: boolean;
  /** The Company this custom plan belongs to. null on catalog plans. */
  customForCompanyId: string | null;
```

- [ ] **Step 3: Run typecheck to see every construction site fail**

```bash
npx tsc --noEmit
```

Expected: FAIL — errors naming `custom` / `customForCompanyId` as missing, in `lib/retainers.ts` and the two test files. That error list is the complete set of sites to fix.

- [ ] **Step 4: Read the two new columns and stop filtering on active**

In `lib/retainers.ts`, add the two field IDs to the `fields` array in `listRetainerTiers`:

```ts
        TIER.fields["Client-facing Description"].id,
        TIER.fields["Custom"].id,
        TIER.fields["Custom For"].id,
```

Add the two properties to the mapped object, after `active`:

```ts
      active: f["Active"] === true,
      custom: f["Custom"] === true,
      customForCompanyId: firstLink(f["Custom For"]),
```

Replace the final return line:

```ts
  return tiers.filter((t) => t.active).sort((a, b) => a.rank - b.rank);
```

with:

```ts
  // Inactive plans are returned deliberately. The board resolves tier names
  // from this list, and tierForRetainer resolves SLA hours from it — filtering
  // here would blank the name on every retainer using a retired plan and drop
  // its live requests to "Not covered". Picker scoping is plansAvailableFor's job.
  return tiers.sort((a, b) => a.rank - b.rank);
```

Then update the doc comment above `listRetainerTiers`: replace `Active tiers, ordered by rank.` with `All tiers, active and inactive, catalog and custom, ordered by rank.`

- [ ] **Step 5: Fix the four test fixtures**

In `tests/retainer-policy.test.ts`, add to **both** the `platinum` and `unfilled` literals:

```ts
  custom: false,
  customForCompanyId: null,
```

In `tests/retainer-board.test.ts`, add the same two lines to **both** the `platinum` and `blankTier` literals.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: `tsc` exit 0, and `pass 43`, `fail 0`. Behaviour is unchanged — every existing plan in the base is `Active`, so returning inactive ones changes nothing yet.

- [ ] **Step 7: Commit**

```bash
git add lib/retainer-types.ts lib/retainers.ts tests/retainer-policy.test.ts tests/retainer-board.test.ts
git commit -m "Carry custom-plan scoping on RetainerTier and keep retired plans readable"
```

---

### Task 3: `lib/retainer-catalog.ts` — plan scoping, legacy mirror, validation

Pure, no I/O, fully tested. Owns the three rules that would otherwise get duplicated across the page, the mutation, and the retainer edit form in Plan B.

**Files:**
- Create: `lib/retainer-catalog.ts`
- Create: `tests/retainer-catalog.test.ts`

**Interfaces:**
- Consumes: `RetainerTier` from Task 2.
- Produces:
  - `LEGACY_TIER_CHOICES` (a `readonly` 7-tuple) and `type LegacyTierChoice`
  - `plansAvailableFor(tiers: RetainerTier[], companyId: string | null): RetainerTier[]`
  - `legacyTierChoiceFor(name: string): LegacyTierChoice | null`
  - `type PlanInput` and `validatePlanInput(input: PlanInput): string | null`

- [ ] **Step 1: Write the failing tests**

Create `tests/retainer-catalog.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_TIER_CHOICES,
  legacyTierChoiceFor,
  plansAvailableFor,
  validatePlanInput,
} from "../lib/retainer-catalog";
import type { RetainerTier } from "../lib/retainer-types";

const ACME = "recAcme00000000001";
const OTHER = "recOther0000000001";

function tier(over: Partial<RetainerTier> & { id: string; name: string }): RetainerTier {
  return {
    rank: 1,
    active: true,
    includedHours: null,
    monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    slaLabel: null,
    maxUrgentPerMonth: null,
    clientDescription: null,
    custom: false,
    customForCompanyId: null,
    ...over,
  };
}

const bronze = tier({ id: "recB", name: "Bronze", rank: 1 });
const gold = tier({ id: "recG", name: "Gold", rank: 3 });
const retired = tier({ id: "recR", name: "Retired", rank: 2, active: false });
const acmeCustom = tier({
  id: "recAC", name: "Acme — Custom", rank: 50, custom: true, customForCompanyId: ACME,
});
const otherCustom = tier({
  id: "recOC", name: "Other — Custom", rank: 51, custom: true, customForCompanyId: OTHER,
});
const orphanCustom = tier({ id: "recXC", name: "Orphan — Custom", rank: 52, custom: true });
const inactiveCustom = tier({
  id: "recIC", name: "Acme — Old", rank: 53, custom: true, customForCompanyId: ACME, active: false,
});

const ALL = [bronze, gold, retired, acmeCustom, otherCustom, orphanCustom, inactiveCustom];

test("plansAvailableFor returns active catalog plans by rank", () => {
  assert.deepEqual(
    plansAvailableFor([gold, bronze], null).map((t) => t.name),
    ["Bronze", "Gold"],
  );
});

test("plansAvailableFor appends this company's custom plans after the catalog", () => {
  assert.deepEqual(
    plansAvailableFor(ALL, ACME).map((t) => t.name),
    ["Bronze", "Gold", "Acme — Custom"],
  );
});

test("plansAvailableFor excludes another company's custom plans", () => {
  assert.equal(
    plansAvailableFor(ALL, ACME).some((t) => t.id === otherCustom.id),
    false,
  );
});

test("plansAvailableFor hides a custom plan with no owning company from everyone", () => {
  assert.equal(plansAvailableFor(ALL, ACME).some((t) => t.id === orphanCustom.id), false);
  assert.equal(plansAvailableFor(ALL, OTHER).some((t) => t.id === orphanCustom.id), false);
  assert.equal(plansAvailableFor(ALL, null).some((t) => t.id === orphanCustom.id), false);
});

test("plansAvailableFor excludes inactive plans, catalog and custom alike", () => {
  const names = plansAvailableFor(ALL, ACME).map((t) => t.name);
  assert.equal(names.includes("Retired"), false);
  assert.equal(names.includes("Acme — Old"), false);
});

test("plansAvailableFor returns catalog only when companyId is null", () => {
  assert.deepEqual(plansAvailableFor(ALL, null).map((t) => t.name), ["Bronze", "Gold"]);
});

test("legacyTierChoiceFor matches each of the seven catalog names", () => {
  for (const name of LEGACY_TIER_CHOICES) {
    assert.equal(legacyTierChoiceFor(name), name);
  }
  assert.equal(LEGACY_TIER_CHOICES.length, 7);
});

test("legacyTierChoiceFor is case-exact and trims surrounding space", () => {
  assert.equal(legacyTierChoiceFor(" Gold "), "Gold");
  assert.equal(legacyTierChoiceFor("gold"), null);
});

test("legacyTierChoiceFor returns null for a custom plan name", () => {
  assert.equal(legacyTierChoiceFor("Acme — Custom"), null);
  assert.equal(legacyTierChoiceFor(""), null);
});

test("validatePlanInput accepts a valid catalog plan", () => {
  assert.equal(
    validatePlanInput({
      name: "Gold", rank: 3, includedHours: 20, monthlyRate: 3000,
      slaHours: { Urgent: 2, High: 4, Medium: 8, Low: 16 },
      custom: false, customForCompanyId: null,
    }),
    null,
  );
});

test("validatePlanInput accepts a valid custom plan", () => {
  assert.equal(
    validatePlanInput({
      name: "Acme — Custom", rank: 50, includedHours: 60, monthlyRate: 8500,
      slaHours: { Urgent: 1, High: 2, Medium: 4, Low: 8 },
      custom: true, customForCompanyId: ACME,
    }),
    null,
  );
});

test("validatePlanInput rejects a blank name", () => {
  const err = validatePlanInput({
    name: "   ", rank: 1, includedHours: null, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: false, customForCompanyId: null,
  });
  assert.match(String(err), /name/i);
});

test("validatePlanInput rejects negative money, hours, and SLA values", () => {
  const base = {
    name: "X", rank: 1, includedHours: null, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: false, customForCompanyId: null,
  };
  assert.match(String(validatePlanInput({ ...base, monthlyRate: -1 })), /rate/i);
  assert.match(String(validatePlanInput({ ...base, includedHours: -1 })), /hours/i);
  assert.match(
    String(validatePlanInput({ ...base, slaHours: { Urgent: -2, High: null, Medium: null, Low: null } })),
    /SLA/i,
  );
});

test("validatePlanInput rejects a non-finite number", () => {
  const err = validatePlanInput({
    name: "X", rank: 1, includedHours: Number.NaN, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: false, customForCompanyId: null,
  });
  assert.match(String(err), /hours/i);
});

test("validatePlanInput rejects a custom plan with no company", () => {
  const err = validatePlanInput({
    name: "Acme — Custom", rank: 50, includedHours: null, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: true, customForCompanyId: null,
  });
  assert.match(String(err), /client|company/i);
});

test("validatePlanInput allows zero as a rate and as included hours", () => {
  assert.equal(
    validatePlanInput({
      name: "Free", rank: 0, includedHours: 0, monthlyRate: 0,
      slaHours: { Urgent: null, High: null, Medium: null, Low: null },
      custom: false, customForCompanyId: null,
    }),
    null,
  );
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../lib/retainer-catalog'`.

- [ ] **Step 3: Write the implementation**

Create `lib/retainer-catalog.ts`:

```ts
// Plan catalog rules: which plans a client may be put on, how a plan name maps
// back to the legacy singleSelect, and what a valid plan looks like.
//
// PURE MODULE — no I/O, no "server-only" import. Keep it that way: the test
// suite imports it directly, and a transitive server-only import breaks every
// test in the run, not just this file's.

import type { RetainerPriority, RetainerTier } from "./retainer-types";

/**
 * The seven choices in Quotes."Retainer Selected Tier". That field is written
 * by the external quote app and may still be what renders the client's
 * document, so it is mirrored — but only when a plan name matches one of these.
 */
export const LEGACY_TIER_CHOICES = [
  "Bronze",
  "Silver",
  "Gold",
  "Premium",
  "Platinum",
  "Sapphire",
  "Diamond",
] as const;

export type LegacyTierChoice = (typeof LEGACY_TIER_CHOICES)[number];

/**
 * Plans this company may be placed on: active catalog plans first, then that
 * company's own active custom plans, each group by rank.
 *
 * A custom plan with no owning company is hidden from EVERY picker rather than
 * offered in all of them — the same fail-closed rule listRetainerAgreements
 * applies to an agreement with no Company link.
 */
export function plansAvailableFor(
  tiers: RetainerTier[],
  companyId: string | null,
): RetainerTier[] {
  const byRank = (a: RetainerTier, b: RetainerTier) => a.rank - b.rank;
  const active = tiers.filter((t) => t.active);
  const catalog = active.filter((t) => !t.custom).sort(byRank);
  const custom = companyId
    ? active.filter((t) => t.custom && t.customForCompanyId === companyId).sort(byRank)
    : [];
  return [...catalog, ...custom];
}

/**
 * The legacy singleSelect value for a plan name, or null when there is none.
 *
 * Null means "leave the legacy field alone" — never blank it. A stale tier name
 * is recoverable by a human; a blank one silently breaks whatever renders the
 * client-facing document.
 */
export function legacyTierChoiceFor(name: string): LegacyTierChoice | null {
  const trimmed = (name ?? "").trim();
  return (LEGACY_TIER_CHOICES as readonly string[]).includes(trimmed)
    ? (trimmed as LegacyTierChoice)
    : null;
}

export type PlanInput = {
  name: string;
  rank: number;
  includedHours: number | null;
  monthlyRate: number | null;
  slaHours: Record<RetainerPriority, number | null>;
  slaLabel?: string | null;
  maxUrgentPerMonth?: number | null;
  clientDescription?: string | null;
  custom: boolean;
  customForCompanyId: string | null;
};

/** Non-negative and finite, or absent. Returns an error string or null. */
function checkNonNegative(value: number | null | undefined, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return `${label} must be a number.`;
  if (value < 0) return `${label} cannot be negative.`;
  return null;
}

/** First problem with this plan, or null when it is valid. */
export function validatePlanInput(input: PlanInput): string | null {
  if (!input.name || input.name.trim() === "") return "Plan name is required.";

  const rate = checkNonNegative(input.monthlyRate, "Monthly rate");
  if (rate) return rate;

  const hours = checkNonNegative(input.includedHours, "Included hours");
  if (hours) return hours;

  const urgentCap = checkNonNegative(input.maxUrgentPerMonth, "Max urgent per month");
  if (urgentCap) return urgentCap;

  for (const priority of ["Urgent", "High", "Medium", "Low"] as RetainerPriority[]) {
    const sla = checkNonNegative(input.slaHours[priority], `SLA — ${priority}`);
    if (sla) return sla;
  }

  if (input.custom && !input.customForCompanyId) {
    return "A custom plan must name the client it belongs to.";
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test
```

Expected: `pass 58`, `fail 0` (43 existing + 15 new).

- [ ] **Step 5: Confirm the module stayed pure**

```bash
grep -nE "server-only|from \"\./airtable\"|from \"\./retainers\"" lib/retainer-catalog.ts
```

Expected: no output. Any match means the test suite will break as soon as another file imports it.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/retainer-catalog.ts tests/retainer-catalog.test.ts
git commit -m "Add pure plan catalog: company scoping, legacy mirror, validation"
```

---

### Task 4: `requestsNeedingSlaRecompute` — which requests a plan edit reaches

Extracted as a pure filter so the backfill rule is testable without Airtable. Lives in `lib/retainer-board.ts` beside the other pure aggregation over `RetainerRequest[]`.

The rule: an answered request keeps its historical outcome forever. A response that met a promise must not retroactively become a breach because the promise later tightened.

**Files:**
- Modify: `lib/retainer-board.ts`
- Modify: `tests/retainer-board.test.ts`

**Interfaces:**
- Consumes: `RetainerRequest`, `OPEN_REQUEST_STATUSES` from `lib/retainer-types.ts`.
- Produces: `requestsNeedingSlaRecompute(requests: RetainerRequest[], retainerIds: string[]): RetainerRequest[]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/retainer-board.test.ts`. Add `requestsNeedingSlaRecompute` to the existing `from "../lib/retainer-board"` import, then:

```ts
function req(over: Partial<RetainerRequest> & { id: string }): RetainerRequest {
  return {
    title: "t",
    retainerId: "recQuoteA",
    companyId: "recCo",
    submittedById: null,
    priority: "High",
    status: "Submitted",
    submittedAt: "2026-08-03T16:00:00.000Z",
    slaDueAt: null,
    firstRespondedAt: null,
    slaOutcome: "Not covered",
    assignedToId: null,
    storyIds: [],
    closedAt: null,
    ...over,
  };
}

test("requestsNeedingSlaRecompute selects open unanswered requests on matching retainers", () => {
  const open = req({ id: "r1" });
  assert.deepEqual(
    requestsNeedingSlaRecompute([open], ["recQuoteA"]).map((r) => r.id),
    ["r1"],
  );
});

test("requestsNeedingSlaRecompute excludes answered requests", () => {
  const answered = req({ id: "r2", firstRespondedAt: "2026-08-03T17:00:00.000Z" });
  assert.deepEqual(requestsNeedingSlaRecompute([answered], ["recQuoteA"]), []);
});

test("requestsNeedingSlaRecompute excludes closed and declined requests", () => {
  const closed = req({ id: "r3", status: "Closed" });
  const declined = req({ id: "r4", status: "Declined" });
  assert.deepEqual(requestsNeedingSlaRecompute([closed, declined], ["recQuoteA"]), []);
});

test("requestsNeedingSlaRecompute excludes requests on an unrelated retainer", () => {
  const other = req({ id: "r5", retainerId: "recQuoteZ" });
  assert.deepEqual(requestsNeedingSlaRecompute([other], ["recQuoteA"]), []);
});

test("requestsNeedingSlaRecompute excludes requests with no submit time", () => {
  const undated = req({ id: "r6", submittedAt: null });
  assert.deepEqual(requestsNeedingSlaRecompute([undated], ["recQuoteA"]), []);
});

test("requestsNeedingSlaRecompute returns nothing when no retainer uses the plan", () => {
  assert.deepEqual(requestsNeedingSlaRecompute([req({ id: "r7" })], []), []);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test
```

Expected: FAIL — `requestsNeedingSlaRecompute is not a function` / not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/retainer-board.ts`:

```ts
/**
 * Requests whose SLA Due At must be recomputed after a plan's SLA hours change.
 *
 * SLA Due At is stamped once at creation and never recalculated, so a request
 * filed while its plan had no SLA keeps a null deadline permanently. Filling
 * the plan in later has to reach back and fix those, or the feature ships inert.
 *
 * Deliberately excludes answered requests: a reply that met a 4-hour promise
 * must not become a breach because the promise was later tightened to 2. It
 * also needs `submittedAt` — the deadline is computed forward from it, and
 * there is nothing to compute from without it.
 */
export function requestsNeedingSlaRecompute(
  requests: RetainerRequest[],
  retainerIds: string[],
): RetainerRequest[] {
  const wanted = new Set(retainerIds);
  return requests.filter(
    (r) =>
      r.retainerId !== null &&
      wanted.has(r.retainerId) &&
      isOpen(r) &&
      !r.firstRespondedAt &&
      !!r.submittedAt,
  );
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test
```

Expected: `pass 64`, `fail 0`.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/retainer-board.ts tests/retainer-board.test.ts
git commit -m "Add pure filter for requests a plan SLA change must reach"
```

---

### Task 5: `lib/mutations/retainer-tier.ts` — plan writes and SLA backfill

**Files:**
- Create: `lib/mutations/retainer-tier.ts`

**Interfaces:**
- Consumes: `PlanInput`, `validatePlanInput` (Task 3); `requestsNeedingSlaRecompute` (Task 4); `listRetainerTiers` (Task 2); `listRetainerAgreements`, `listRetainerRequests`, `computeSlaDueAt`, `evaluateSlaOutcome`, `createRecords`, `patchRecords` (existing).
- Produces:
  - `type PlanMutationResult<T = unknown> = ({ ok: true } & T) | { error: string }`
  - `createPlan(input: PlanInput): Promise<PlanMutationResult<{ id: string }>>`
  - `updatePlan(id: string, patch: Partial<PlanInput>): Promise<PlanMutationResult<{ recomputed: number }>>`
  - `setPlanActive(id: string, active: boolean): Promise<PlanMutationResult>`

- [ ] **Step 1: Write the implementation**

Create `lib/mutations/retainer-tier.ts`:

```ts
// Server Actions for the retainer plan catalog.
//
// Stricter than lib/mutations/retainer-request.ts on purpose: that file gates
// on requireSignedIn() because clients must be able to file their own requests.
// Nobody outside admin/lead may touch a plan's pricing or its SLA promises.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import { listRetainerAgreements, listRetainerTiers } from "../retainers";
import { listRetainerRequests } from "../retainer-requests";
import { computeSlaDueAt, evaluateSlaOutcome } from "../retainer-policy";
import { requestsNeedingSlaRecompute } from "../retainer-board";
import { validatePlanInput, type PlanInput } from "../retainer-catalog";
import type { RetainerPriority } from "../retainer-types";

const TIER = Tables.RetainerTiers;
const REQ = Tables.RetainerRequests;

export type PlanMutationResult<T = unknown> = ({ ok: true } & T) | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireRole("admin", "lead");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("retainers:tiers");
}

const PRIORITIES: RetainerPriority[] = ["Urgent", "High", "Medium", "Low"];

const SLA_FIELD: Record<RetainerPriority, string> = {
  Urgent: "SLA — Urgent (business hrs)",
  High: "SLA — High (business hrs)",
  Medium: "SLA — Medium (business hrs)",
  Low: "SLA — Low (business hrs)",
};

/** PlanInput -> Airtable field payload. Undefined keys are left untouched. */
function planFields(patch: Partial<PlanInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (patch.name !== undefined) f["Tier Name"] = patch.name.trim();
  if (patch.rank !== undefined) f["Rank"] = patch.rank;
  if (patch.includedHours !== undefined) f["Included Hours"] = patch.includedHours;
  if (patch.monthlyRate !== undefined) f["Monthly Rate"] = patch.monthlyRate;
  if (patch.slaLabel !== undefined) f["SLA Label (client-facing)"] = patch.slaLabel;
  if (patch.maxUrgentPerMonth !== undefined) f["Max Urgent / Month"] = patch.maxUrgentPerMonth;
  if (patch.clientDescription !== undefined) {
    f["Client-facing Description"] = patch.clientDescription;
  }
  if (patch.custom !== undefined) f["Custom"] = patch.custom;
  if (patch.customForCompanyId !== undefined) {
    f["Custom For"] = patch.customForCompanyId ? [patch.customForCompanyId] : [];
  }
  if (patch.slaHours !== undefined) {
    for (const p of PRIORITIES) f[SLA_FIELD[p]] = patch.slaHours[p];
  }
  return f;
}

/**
 * Re-stamp SLA Due At and SLA Outcome for open, unanswered requests on every
 * retainer using this plan. Returns how many were touched.
 *
 * Reads UNCACHED. The 5-minute cache would otherwise hand back the pre-edit
 * plan and write deadlines from the SLA hours we just replaced — and nothing
 * downstream ever recomputes SLA Due At, so those would be wrong permanently.
 */
async function recomputeSlaForPlan(tierId: string): Promise<number> {
  const [tiers, agreements, requests] = await Promise.all([
    listRetainerTiers({ fresh: true }),
    listRetainerAgreements({ fresh: true }),
    listRetainerRequests(),
  ]);

  const tier = tiers.find((t) => t.id === tierId) ?? null;
  if (!tier) return 0;

  const retainerIds = agreements.filter((a) => a.tierId === tierId).map((a) => a.id);
  const affected = requestsNeedingSlaRecompute(requests, retainerIds);
  if (affected.length === 0) return 0;

  const now = new Date();
  const patches = affected.map((r) => {
    const dueAt = computeSlaDueAt(tier, r.priority ?? "Medium", new Date(r.submittedAt as string));
    return {
      id: r.id,
      fields: {
        "SLA Due At": dueAt ? dueAt.toISOString() : null,
        "SLA Outcome": evaluateSlaOutcome({ dueAt, firstRespondedAt: null, now }),
      },
    };
  });

  await patchRecords(REQ.id, patches);
  revalidateTag("retainers:requests");
  return patches.length;
}

export async function createPlan(
  input: PlanInput,
): Promise<PlanMutationResult<{ id: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const invalid = validatePlanInput(input);
  if (invalid) return { error: invalid };

  try {
    const [created] = await createRecords(TIER.id, [
      { fields: { ...planFields(input), Active: true } },
    ]);
    invalidate();
    return { ok: true, id: created.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updatePlan(
  id: string,
  patch: Partial<PlanInput>,
): Promise<PlanMutationResult<{ recomputed: number }>> {
  const denied = await gate();
  if (denied) return denied;

  try {
    // Validate the MERGED plan, not the patch — a patch that only clears a
    // company would otherwise slip past the custom-needs-a-client rule.
    const tiers = await listRetainerTiers({ fresh: true });
    const existing = tiers.find((t) => t.id === id);
    if (!existing) return { error: "Plan not found." };

    const merged: PlanInput = {
      name: patch.name ?? existing.name,
      rank: patch.rank ?? existing.rank,
      includedHours: patch.includedHours !== undefined ? patch.includedHours : existing.includedHours,
      monthlyRate: patch.monthlyRate !== undefined ? patch.monthlyRate : existing.monthlyRate,
      slaHours: patch.slaHours ?? existing.slaHours,
      slaLabel: patch.slaLabel !== undefined ? patch.slaLabel : existing.slaLabel,
      maxUrgentPerMonth:
        patch.maxUrgentPerMonth !== undefined ? patch.maxUrgentPerMonth : existing.maxUrgentPerMonth,
      clientDescription:
        patch.clientDescription !== undefined ? patch.clientDescription : existing.clientDescription,
      custom: patch.custom ?? existing.custom,
      customForCompanyId:
        patch.customForCompanyId !== undefined
          ? patch.customForCompanyId
          : existing.customForCompanyId,
    };

    const invalid = validatePlanInput(merged);
    if (invalid) return { error: invalid };

    const slaChanged =
      patch.slaHours !== undefined &&
      PRIORITIES.some((p) => patch.slaHours![p] !== existing.slaHours[p]);

    await patchRecords(TIER.id, [{ id, fields: planFields(patch) }]);

    const recomputed = slaChanged ? await recomputeSlaForPlan(id) : 0;
    invalidate();
    return { ok: true, recomputed };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Soft delete. Plans are NEVER hard-deleted — a live retainer linking a removed
 * plan would lose both its tier name and its SLA, silently.
 */
export async function setPlanActive(
  id: string,
  active: boolean,
): Promise<PlanMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(TIER.id, [{ id, fields: { Active: active } }]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
```

- [ ] **Step 2: Verify it compiles and breaks nothing**

```bash
npx tsc --noEmit && npm test
```

Expected: `tsc` exit 0, `pass 64`, `fail 0`.

- [ ] **Step 3: Confirm the authorization gate is actually present on all three**

```bash
grep -c "await gate()" lib/mutations/retainer-tier.ts
```

Expected: `3`. Fewer means an exported action is ungated — stop and fix before committing.

- [ ] **Step 4: Commit**

```bash
git add lib/mutations/retainer-tier.ts
git commit -m "Add plan catalog mutations with SLA backfill for open requests"
```

---

### Task 6: `/retainers/plans` — the manager-facing page

**Files:**
- Create: `app/(app)/retainers/plans/page.tsx` (Server Component)
- Create: `components/retainers/PlanCatalog.tsx` (Client Component)
- Modify: `lib/nav.ts`
- Modify: `lib/permissions.ts`

**Interfaces:**
- Consumes: `listRetainerTiers` (Task 2); `createPlan`, `updatePlan`, `setPlanActive` (Task 5); `RetainerTier` (Task 2).
- Produces: the route `/retainers/plans`.

- [ ] **Step 1: Gate the route**

In `lib/permissions.ts`, `ROUTE_PERMISSION` is keyed on the **first path segment**, and `retainers: "Delivery"` already covers `/retainers/plans`. Confirm it is there:

```bash
grep -n 'retainers: "Delivery"' lib/permissions.ts
```

Expected: one line. If missing, add `retainers: "Delivery",` to `ROUTE_PERMISSION`.

- [ ] **Step 2: Add the nav entry**

In `lib/nav.ts`, immediately after the `/retainers` entry in `NAV_ITEMS`:

```ts
  {
    href: "/retainers/plans",
    label: "Retainer Plans",
    desc: "Rates, included hours, and response-time promises · custom plans per client",
    group: "delivery",
    showInSidebar: true,
    showOnHome: false,
  },
```

- [ ] **Step 3: Write the client component**

Create `components/retainers/PlanCatalog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlan, setPlanActive, updatePlan } from "@/lib/mutations/retainer-tier";
import { RETAINER_PRIORITIES, type RetainerPriority, type RetainerTier } from "@/lib/retainer-types";

type CompanyOption = { id: string; name: string };

type Draft = {
  name: string;
  rank: string;
  monthlyRate: string;
  includedHours: string;
  slaLabel: string;
  sla: Record<RetainerPriority, string>;
  custom: boolean;
  customForCompanyId: string;
};

const EMPTY: Draft = {
  name: "",
  rank: "",
  monthlyRate: "",
  includedHours: "",
  slaLabel: "",
  sla: { Urgent: "", High: "", Medium: "", Low: "" },
  custom: false,
  customForCompanyId: "",
};

function draftFrom(t: RetainerTier): Draft {
  const s = (v: number | null) => (v === null ? "" : String(v));
  return {
    name: t.name,
    rank: s(t.rank),
    monthlyRate: s(t.monthlyRate),
    includedHours: s(t.includedHours),
    slaLabel: t.slaLabel ?? "",
    sla: {
      Urgent: s(t.slaHours.Urgent),
      High: s(t.slaHours.High),
      Medium: s(t.slaHours.Medium),
      Low: s(t.slaHours.Low),
    },
    custom: t.custom,
    customForCompanyId: t.customForCompanyId ?? "",
  };
}

/** "" -> null so a cleared field blanks the column instead of writing 0. */
function numOrNull(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toInput(d: Draft) {
  return {
    name: d.name,
    rank: numOrNull(d.rank) ?? 999,
    monthlyRate: numOrNull(d.monthlyRate),
    includedHours: numOrNull(d.includedHours),
    slaLabel: d.slaLabel.trim() === "" ? null : d.slaLabel.trim(),
    slaHours: {
      Urgent: numOrNull(d.sla.Urgent),
      High: numOrNull(d.sla.High),
      Medium: numOrNull(d.sla.Medium),
      Low: numOrNull(d.sla.Low),
    },
    custom: d.custom,
    customForCompanyId: d.custom ? (d.customForCompanyId || null) : null,
  };
}

const input =
  "px-2 py-1 text-[12px] bg-bg-elevated border border-rule text-ink rounded focus:border-emerald focus:outline-none";

export function PlanCatalog({
  tiers,
  companies,
  canEdit,
}: {
  tiers: RetainerTier[];
  companies: CompanyOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Separate from `pending`, which only covers the router.refresh transition.
  // Without this the Save button stays live during the await and a double-click
  // creates the plan twice.
  const [busy, setBusy] = useState(false);
  const locked = busy || pending;

  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "unknown client") : null;

  function done(msg: string) {
    setError(null);
    setMessage(msg);
    setEditing(null);
    setCreating(false);
    setDraft(EMPTY);
    // router.refresh() is required — router.push alone serves the client Router
    // Cache and the edit would appear to do nothing until a manual reload.
    startTransition(() => router.refresh());
  }

  async function save() {
    if (locked) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const payload = toInput(draft);
      const res = creating
        ? await createPlan(payload)
        : await updatePlan(editing as string, payload);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const recomputed = "recomputed" in res ? res.recomputed : 0;
      done(
        recomputed > 0
          ? `Saved. ${recomputed} open request${recomputed === 1 ? "" : "s"} picked up the new response times.`
          : "Saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: RetainerTier) {
    if (locked) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await setPlanActive(t.id, !t.active);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      done(t.active ? `${t.name} retired.` : `${t.name} restored.`);
    } finally {
      setBusy(false);
    }
  }

  const catalog = tiers.filter((t) => !t.custom);
  const custom = tiers.filter((t) => t.custom);

  function editor() {
    return (
      <div className="bg-bg-elevated border border-emerald/30 rounded-card p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="eyebrow block mb-1">Plan name</span>
            <input
              className={`${input} w-full`}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1">Rank</span>
            <input
              className={`${input} w-full`}
              value={draft.rank}
              onChange={(e) => setDraft({ ...draft, rank: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1">Monthly rate</span>
            <input
              className={`${input} w-full`}
              value={draft.monthlyRate}
              onChange={(e) => setDraft({ ...draft, monthlyRate: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1">Included hours</span>
            <input
              className={`${input} w-full`}
              value={draft.includedHours}
              onChange={(e) => setDraft({ ...draft, includedHours: e.target.value })}
            />
          </label>
        </div>

        <div>
          <div className="eyebrow mb-1">
            First response, in business hours · 9am–6pm Mon–Fri Pacific
          </div>
          <div className="grid grid-cols-4 gap-3">
            {RETAINER_PRIORITIES.map((p) => (
              <label key={p} className="block">
                <span className="text-[11px] text-ink-muted block mb-1">{p}</span>
                <input
                  className={`${input} w-full`}
                  placeholder="not covered"
                  value={draft.sla[p]}
                  onChange={(e) => {
                    // Mutate a copy rather than `{ ...draft.sla, [p]: v }` — a
                    // computed union key in a spread widens the type and fails
                    // to satisfy Record<RetainerPriority, string> under strict.
                    const sla = { ...draft.sla };
                    sla[p] = e.target.value;
                    setDraft({ ...draft, sla });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            Leave blank to leave that priority uncovered. A blank never counts as a breach.
          </div>
        </div>

        <label className="block">
          <span className="eyebrow block mb-1">Client-facing SLA label</span>
          <input
            className={`${input} w-full`}
            placeholder="e.g. 2 business hours on urgent"
            value={draft.slaLabel}
            onChange={(e) => setDraft({ ...draft, slaLabel: e.target.value })}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12px] text-ink-muted flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-emerald"
              checked={draft.custom}
              onChange={(e) => setDraft({ ...draft, custom: e.target.checked })}
            />
            Custom plan for one client
          </label>
          {draft.custom && (
            <select
              className={input}
              value={draft.customForCompanyId}
              onChange={(e) => setDraft({ ...draft, customForCompanyId: e.target.value })}
            >
              <option value="">Select a client…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={locked}
            className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium disabled:opacity-50"
          >
            {locked ? "Saving…" : "Save plan"}
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setCreating(false);
              setError(null);
            }}
            className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function row(t: RetainerTier) {
    const fmt = (v: number | null) => (v === null ? "—" : String(v));
    return (
      <tr key={t.id} className={`border-b border-rule/50 ${t.active ? "" : "opacity-50"}`}>
        <td className="px-4 py-2.5">
          <div className="text-ink-strong">{t.name}</div>
          {t.custom && (
            <div className="text-[10px] text-purple">
              custom · {companyName(t.customForCompanyId) ?? "no client — hidden everywhere"}
            </div>
          )}
          {!t.active && <div className="text-[10px] text-ink-faint">retired</div>}
        </td>
        <td className="px-3 py-2.5 text-right tabnum text-ink-muted">{fmt(t.monthlyRate)}</td>
        <td className="px-3 py-2.5 text-right tabnum text-ink-muted">{fmt(t.includedHours)}</td>
        {RETAINER_PRIORITIES.map((p) => (
          <td key={p} className="px-3 py-2.5 text-right tabnum">
            {t.slaHours[p] === null ? (
              <span className="text-amber" title="Not covered — requests at this priority are never measured">
                —
              </span>
            ) : (
              <span className="text-ink">{t.slaHours[p]}h</span>
            )}
          </td>
        ))}
        <td className="px-3 py-2.5 text-right">
          {canEdit && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(t.id);
                  setDraft(draftFrom(t));
                  setMessage(null);
                  setError(null);
                }}
                className="text-[11px] text-ink-muted hover:text-emerald"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(t)}
                disabled={locked}
                className="text-[11px] text-ink-faint hover:text-amber disabled:opacity-50"
              >
                {t.active ? "Retire" : "Restore"}
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  function table(rows: RetainerTier[], heading: string, empty: string) {
    return (
      <section className="bg-surface border border-rule rounded-card mb-5">
        <div className="px-4 py-3 border-b border-rule eyebrow">{heading}</div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-ink-muted">{empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-ink-faint border-b border-rule">
                  <th className="text-left font-medium px-4 py-2">Plan</th>
                  <th className="text-right font-medium px-3 py-2">Rate</th>
                  <th className="text-right font-medium px-3 py-2">Hours</th>
                  {RETAINER_PRIORITIES.map((p) => (
                    <th key={p} className="text-right font-medium px-3 py-2">
                      {p}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>{rows.map(row)}</tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-surface border border-red/30 rounded-card px-4 py-2.5 text-[12px] text-red mb-4">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-surface border border-emerald/30 rounded-card px-4 py-2.5 text-[12px] text-emerald mb-4">
          {message}
        </div>
      )}

      {canEdit && !creating && editing === null && (
        <button
          onClick={() => {
            setCreating(true);
            setDraft(EMPTY);
            setMessage(null);
            setError(null);
          }}
          className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium mb-4"
        >
          New plan
        </button>
      )}

      {(creating || editing !== null) && <div className="mb-5">{editor()}</div>}

      {table(catalog, "Catalog", "No catalog plans yet.")}
      {table(
        custom,
        "Custom plans",
        "No custom plans. Create one and tick “Custom plan for one client”.",
      )}
    </>
  );
}
```

- [ ] **Step 4: Write the page**

Create `app/(app)/retainers/plans/page.tsx`:

```tsx
// Retainer plan catalog — rates, included hours, and SLA response windows.
// This is where the SLA engine gets its numbers; every column is blank until
// a manager fills it, and a blank column means "not covered", never a breach.
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanCatalog } from "@/components/retainers/PlanCatalog";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";
import { listRetainerTiers } from "@/lib/retainers";
import { listRecordsCached } from "@/lib/airtable";
import { Tables } from "@/lib/schema";
import type { RetainerTier } from "@/lib/retainer-types";

export const revalidate = 300;

async function companyOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    Tables.Companies.id,
    { fields: [Tables.Companies.fields["Name"].id] },
    ["retainers:company-names"],
  );
  return rows
    .flatMap((r) => {
      const n = r.fields["Name"];
      return typeof n === "string" && n.trim() !== "" ? [{ id: r.id, name: n }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function RetainerPlansRoute() {
  await assertCanAccess("/retainers/plans");

  const canEdit = await canMutate();
  let tiers: RetainerTier[] = [];
  let companies: { id: string; name: string }[] = [];
  let error: string | null = null;

  try {
    [tiers, companies] = await Promise.all([listRetainerTiers(), companyOptions()]);
  } catch (e) {
    error = (e as Error).message;
  }

  const uncovered = tiers.filter(
    (t) => t.active && Object.values(t.slaHours).every((h) => h === null),
  ).length;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Retainer Plans"
        subtitle="Rates, included hours, and first-response promises. Clocks run 9am–6pm Mon–Fri Pacific."
        meta={
          <div className="font-mono tabnum">
            {tiers.length} plan{tiers.length === 1 ? "" : "s"}
          </div>
        }
      />

      {error ? (
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load plans: {error}
        </div>
      ) : (
        <>
          {uncovered > 0 && (
            <div className="bg-surface border border-amber/30 rounded-card px-4 py-2.5 text-[12px] text-amber mb-4">
              {uncovered} active plan{uncovered === 1 ? " has" : "s have"} no response times set.
              Requests on {uncovered === 1 ? "it" : "them"} are recorded but never measured.
            </div>
          )}
          <PlanCatalog tiers={tiers} companies={companies} canEdit={canEdit} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Verify it compiles and builds**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: `tsc` exit 0, `pass 64`, build exit 0 with `/retainers/plans` in the route table.

- [ ] **Step 6: Confirm the page is actually gated, not just hidden**

```bash
grep -n "assertCanAccess" "app/(app)/retainers/plans/page.tsx"
```

Expected: one line calling `assertCanAccess("/retainers/plans")`. Nav hiding is not a gate.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/retainers/plans/page.tsx" components/retainers/PlanCatalog.tsx lib/nav.ts lib/permissions.ts
git commit -m "Add /retainers/plans catalog page with custom plans per client"
```

---

### Task 7: End-to-end verification against the live base

The production base holds real revenue numbers. Every record created here is deleted afterwards, and the one live retainer — Gracie Barra — is left exactly as found.

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Full local gate**

```bash
npm test && npx tsc --noEmit && npm run build && (set -a; . ./.env.local; set +a; npm run verify-schema)
```

Expected: `pass 64`, `tsc` exit 0, build exit 0, `✅ Schema OK`.

- [ ] **Step 2: Record the current state of Platinum so it can be restored**

```bash
set -a; . ./.env.local; set +a
curl -s -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  "https://api.airtable.com/v0/app4vhhWMbRFOloOU/tblT6U9M9EFa4lKu0/recIaQ8Q51Czl98x7" \
  | tee /tmp/platinum-before.json
```

Expected: JSON showing `Monthly Rate: 6750`, `Included Hours: 45`, and no SLA fields. Keep this file until Step 8.

- [ ] **Step 3: Start the dev server and sign in**

```bash
npm run dev
```

Open `http://localhost:3000/retainers/plans`. Expected: the amber banner reporting that 7 active plans have no response times, the Catalog table with all 7 plans, and an empty Custom plans table.

- [ ] **Step 4: Fill Platinum's response times**

Edit Platinum → Urgent `2`, High `4`, Medium `8`, Low `16` → Save.

Expected: a green confirmation. If any open Gracie Barra request existed, it reads `N open requests picked up the new response times`; with none, it reads just `Saved.` Reload — the four values persist and the amber banner now says 6 plans.

- [ ] **Step 5: Verify the backfill actually reached a real request**

Only meaningful if an open, unanswered Gracie Barra request exists. Check:

```bash
set -a; . ./.env.local; set +a
curl -s -G -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  --data-urlencode "filterByFormula={SLA Outcome}='Not covered'" \
  "https://api.airtable.com/v0/app4vhhWMbRFOloOU/tblRBsPqSvzvAuSyY" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['records']), 'still not covered')"
```

If a Gracie Barra request was open and unanswered before Step 4, it must now have a non-null `SLA Due At` and an outcome of `Pending` or `Breached`, not `Not covered`. If the table is empty, note that the backfill path was not exercised with live data and say so plainly rather than claiming it was.

- [ ] **Step 6: Create a custom plan and confirm it is scoped**

New plan → name `ZZ Test — Custom`, rank `900`, rate `1`, hours `1`, Urgent `1`, tick **Custom plan for one client**, select a company that is **not** Gracie Barra → Save.

Expected: it appears under **Custom plans**, labelled with that client, and **not** under Catalog.

- [ ] **Step 7: Confirm retire keeps a plan readable**

Retire `ZZ Test — Custom`. Expected: the row dims and reads `retired`, and it stays visible on this page — this page shows all plans, while pickers built in Plan B will not offer it.

- [ ] **Step 8: Delete the test plan and restore Platinum**

```bash
set -a; . ./.env.local; set +a
# Find the test record id
curl -s -G -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  --data-urlencode "filterByFormula={Tier Name}='ZZ Test — Custom'" \
  "https://api.airtable.com/v0/app4vhhWMbRFOloOU/tblT6U9M9EFa4lKu0" \
  | python3 -c "import json,sys; [print(r['id']) for r in json.load(sys.stdin)['records']]"
```

Delete each id returned:

```bash
curl -s -X DELETE -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  "https://api.airtable.com/v0/app4vhhWMbRFOloOU/tblT6U9M9EFa4lKu0/<REC_ID>"
```

**Leave Platinum's SLA values in place** — they are real and the manager wants them. Confirm against `/tmp/platinum-before.json` that rate and hours are still `6750` / `45` and nothing else changed.

- [ ] **Step 9: Confirm the base is clean**

```bash
set -a; . ./.env.local; set +a
curl -s -G -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  --data-urlencode "filterByFormula=FIND('ZZ Test', {Tier Name})" \
  "https://api.airtable.com/v0/app4vhhWMbRFOloOU/tblT6U9M9EFa4lKu0" \
  | python3 -c "import json,sys; print(len(json.load(sys.stdin)['records']), 'test plans left')"
```

Expected: `0 test plans left`.

- [ ] **Step 10: Commit nothing, report honestly**

There is nothing to commit unless a defect was found and fixed. Report which steps passed, which were not exercisable against live data (Step 5 in particular), and anything left behind.

---

## Definition of done

- `npm test` reports 64 passing, 0 failing.
- `npx tsc --noEmit` exits 0.
- `npm run build` exits 0 from a clean tree.
- `npm run verify-schema` reports `✅ Schema OK`.
- A manager can set every plan's rate, hours, and four SLA windows at `/retainers/plans`.
- A custom plan can be created for one client and does not appear in the catalog.
- Retiring a plan hides it from pickers without blanking the tier name or SLA of any retainer using it.
- Filling a plan's SLA columns re-stamps `SLA Due At` on open, unanswered requests using that plan, and leaves answered requests untouched.
- No test records remain in the production base.

## Not in this plan

Creating and editing retainers themselves, the plan picker on `/retainers/[id]`, the legacy `Retainer Selected Tier` mirror on write, and splitting the board into Active / Not active are **Plan B**. `legacyTierChoiceFor` is built and tested here because it belongs with the catalog rules, but nothing calls it until Plan B.
