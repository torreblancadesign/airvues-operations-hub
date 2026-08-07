# Retainer SLA Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the business-day SLA engine and Airtable tier-resolution layer that the retainer manager board (Plan 2) and the client portal (Plan 4) both depend on.

**Architecture:** Three layers, strictly separated. `lib/retainer-sla.ts` is pure date arithmetic with zero I/O and zero dependencies — it is copied verbatim into the portal repo later, so it must never import Airtable or Next. `lib/retainer-policy.ts` maps a tier plus a priority to a deadline and an outcome, also pure. `lib/retainers.ts` is the only layer that touches Airtable, and it is `server-only`.

**Tech Stack:** TypeScript strict · Node built-in test runner (`node:test`) via the existing `tsx` devDependency · no new runtime dependencies · Airtable REST via the existing `lib/airtable.ts`.

**Spec:** `docs/superpowers/specs/2026-08-06-retainer-portal-design.md`

## Global Constraints

- **No new runtime dependencies.** `tsx@4.16.2` is already a devDependency; `node:test` and `Intl` are built in. Do not add date-fns, luxon, dayjs, or a test framework.
- **`lib/retainer-sla.ts` must stay dependency-free and I/O-free.** It is duplicated into `airvues-retainer-portal` later. No `import "server-only"`, no Airtable, no Next.
- **Timezone is `America/Los_Angeles` as an IANA identifier**, never a fixed `-08:00` offset. DST correctness is a tested requirement.
- **Business window: 09:00–18:00, Monday–Friday.** A 9-hour day.
- **A deadline landing exactly on 18:00 stays at 18:00.** It does not roll to 09:00 next morning. Rolling would gift an extra overnight on every exact-multiple SLA.
- **A missing tier, or a blank SLA number, yields `"Not covered"` and MUST NEVER produce `"Breached"`.** This is what lets the portal ship before management fills the tier table.
- **Never import `lib/airtable.ts` from a client component.** It carries `AIRTABLE_TOKEN`.
- **Field access goes through `lib/schema.ts` IDs**, never hardcoded `fld…` strings and never raw display names. Field names contain em-dashes (`SLA — Urgent (business hrs)`) that are byte-sensitive.
- **Verification gate for every task:** `npm test`, `npx tsc --noEmit`, and `npm run build` must all exit 0.

## File Structure

| File | Responsibility |
|---|---|
| `lib/retainer-sla.ts` | **Create.** Pure business-day arithmetic. No I/O, no deps. |
| `lib/retainer-policy.ts` | **Create.** Tier + priority → deadline; response → outcome. Pure. |
| `lib/retainer-types.ts` | **Create.** Client-safe types shared by server and client components. |
| `lib/retainers.ts` | **Create.** `server-only` Airtable reads for tiers and agreements. |
| `tests/retainer-sla.test.ts` | **Create.** Business-day arithmetic, incl. DST and holidays. |
| `tests/retainer-policy.test.ts` | **Create.** Deadline resolution and outcome evaluation. |
| `package.json` | **Modify.** Add the `test` script. |

Tests live in `tests/` rather than beside the source so that `next build` never considers them part of the app graph. They use **relative imports** (`../lib/…`), not the `@/` alias, because the alias is resolved by Next and is not guaranteed under the bare `node --import tsx` runner.

---

### Task 1: Business-day arithmetic

**Files:**
- Create: `lib/retainer-sla.ts`
- Create: `tests/retainer-sla.test.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `TZ: string`, `DAY_START_HOUR: number`, `DAY_END_HOUR: number`, `HOLIDAYS: string[]`
  - `zonedParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number }`
  - `fromZoned(y: number, mo: number, d: number, h: number, mi?: number): Date`
  - `isoDate(d: Date): string`
  - `isBusinessDay(d: Date): boolean`
  - `clampToBusiness(d: Date): Date`
  - `addBusinessHours(start: Date, hours: number): Date`
  - `businessHoursBetween(start: Date, end: Date): number`

- [ ] **Step 1: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "node --import tsx --test tests/*.test.ts"
```

- [ ] **Step 2: Write the failing test**

Create `tests/retainer-sla.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessHours,
  businessHoursBetween,
  clampToBusiness,
  fromZoned,
  zonedParts,
} from "../lib/retainer-sla";

const fmt = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

test("mid-day add stays same day", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 10, 0), 4)), "2026-08-06 14:00");
});

test("Friday 17:00 + 4h rolls to Monday 12:00", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 7, 17, 0), 4)), "2026-08-10 12:00");
});

test("submitted before open clamps to 09:00", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 6, 0), 1)), "2026-08-06 10:00");
});

test("submitted after close rolls to next morning", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 23, 0), 2)), "2026-08-07 11:00");
});

test("weekend submission starts Monday", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 8, 12, 0), 1)), "2026-08-10 10:00");
});

test("spans DST spring-forward (2026-03-08)", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 3, 6, 17, 0), 4)), "2026-03-09 12:00");
});

test("spans DST fall-back (2026-11-01)", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 10, 30, 17, 0), 4)), "2026-11-02 12:00");
});

test("skips a holiday", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 12, 24, 17, 0), 2)), "2026-12-28 10:00");
});

test("deadline landing exactly at close stays at close, does not roll", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 9, 0), 9)), "2026-08-06 18:00");
});

test("businessHoursBetween same day", () => {
  assert.equal(businessHoursBetween(fromZoned(2026, 8, 6, 10, 0), fromZoned(2026, 8, 6, 14, 30)), 4.5);
});

test("businessHoursBetween ignores the weekend", () => {
  assert.equal(businessHoursBetween(fromZoned(2026, 8, 7, 17, 0), fromZoned(2026, 8, 10, 12, 0)), 4);
});

test("businessHoursBetween round-trips addBusinessHours", () => {
  const s = fromZoned(2026, 8, 7, 16, 30);
  assert.equal(Math.round(businessHoursBetween(s, addBusinessHours(s, 6)) * 100) / 100, 6);
});

test("clampToBusiness is idempotent inside the window", () => {
  const d = fromZoned(2026, 8, 6, 11, 0);
  assert.equal(clampToBusiness(d).getTime(), d.getTime());
});

test("businessHoursBetween returns 0 when end precedes start", () => {
  assert.equal(businessHoursBetween(fromZoned(2026, 8, 6, 14, 0), fromZoned(2026, 8, 6, 10, 0)), 0);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/retainer-sla'`.

- [ ] **Step 4: Write the implementation**

Create `lib/retainer-sla.ts`. This code is verified — all 14 assertions above pass against it.

```ts
// Business-day arithmetic for retainer SLA deadlines.
//
// PURE MODULE — no I/O, no dependencies, no Next, no Airtable. This file is
// duplicated verbatim into airvues-retainer-portal; keep it that way.
//
// Window: 09:00-18:00 Mon-Fri in America/Los_Angeles (IANA, so DST is handled).
// A deadline landing exactly on 18:00 STAYS at 18:00 — it does not roll to the
// next morning, which would gift an extra overnight on every exact multiple.

export const TZ = "America/Los_Angeles";
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18;

/** Airvues holidays, as YYYY-MM-DD in TZ. Update yearly. */
export const HOLIDAYS: string[] = ["2026-01-01", "2026-07-03", "2026-11-26", "2026-12-25"];

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DTF = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Wall-clock parts of an instant, as seen in TZ. */
export function zonedParts(d: Date): Parts {
  const m: Record<string, string> = {};
  for (const p of DTF.formatToParts(d)) if (p.type !== "literal") m[p.type] = p.value;
  return {
    year: +m.year,
    month: +m.month,
    day: +m.day,
    // Intl emits "24" for midnight under hour12:false; normalise to 0.
    hour: +m.hour % 24,
    minute: +m.minute,
    second: +m.second,
  };
}

function offsetMs(d: Date): number {
  const p = zonedParts(d);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - d.getTime();
}

/**
 * TZ wall-clock -> UTC instant. Two-pass: the first offset lookup can be wrong
 * across a DST transition, so we re-resolve against the corrected instant.
 */
export function fromZoned(y: number, mo: number, d: number, h: number, mi = 0): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const o1 = offsetMs(new Date(guess));
  let ts = guess - o1;
  const o2 = offsetMs(new Date(ts));
  if (o2 !== o1) ts = guess - o2;
  return new Date(ts);
}

/** YYYY-MM-DD of an instant, as seen in TZ. */
export function isoDate(d: Date): string {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function weekdayIndex(d: Date): number {
  const p = zonedParts(d);
  // Date-only value read back in UTC — no timezone conversion involved.
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

export function isBusinessDay(d: Date): boolean {
  const wd = weekdayIndex(d);
  if (wd === 0 || wd === 6) return false;
  return !HOLIDAYS.includes(isoDate(d));
}

function dayWindow(d: Date): { open: Date; close: Date } {
  const p = zonedParts(d);
  return {
    open: fromZoned(p.year, p.month, p.day, DAY_START_HOUR),
    close: fromZoned(p.year, p.month, p.day, DAY_END_HOUR),
  };
}

function nextDayStart(d: Date): Date {
  const p = zonedParts(d);
  // Calendar arithmetic ONLY. Date.UTC handles month/year rollover and we read
  // it back with getUTC* so no conversion happens. Converting a UTC-midnight
  // instant into TZ wall-clock lands on the PREVIOUS local day — that bug made
  // every rollover case silently return the wrong day.
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return fromZoned(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), DAY_START_HOUR);
}

/** Move an instant forward to the next moment inside the business window. */
export function clampToBusiness(d: Date): Date {
  let cur = d;
  for (let i = 0; i < 400; i++) {
    if (!isBusinessDay(cur)) {
      cur = nextDayStart(cur);
      continue;
    }
    const { open, close } = dayWindow(cur);
    if (cur < open) return open;
    if (cur >= close) {
      cur = nextDayStart(cur);
      continue;
    }
    return cur;
  }
  throw new Error("clampToBusiness: no business day found within 400 iterations");
}

/** start + `hours` business hours. Non-positive `hours` clamps to the window. */
export function addBusinessHours(start: Date, hours: number): Date {
  if (!(hours > 0)) return clampToBusiness(start);
  let cur = clampToBusiness(start);
  let remaining = hours * 3_600_000;
  for (let i = 0; i < 4000; i++) {
    const { close } = dayWindow(cur);
    const avail = close.getTime() - cur.getTime();
    // `<=` keeps an exact-boundary result at close rather than rolling it.
    if (remaining <= avail) return new Date(cur.getTime() + remaining);
    remaining -= avail;
    cur = clampToBusiness(close);
  }
  throw new Error("addBusinessHours: exceeded iteration budget");
}

/** Business hours elapsed between two instants. 0 if end <= start. */
export function businessHoursBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let cur = clampToBusiness(start);
  let total = 0;
  for (let i = 0; i < 4000; i++) {
    if (cur >= end) break;
    const { close } = dayWindow(cur);
    const segEnd = close < end ? close : end;
    if (segEnd > cur) total += segEnd.getTime() - cur.getTime();
    if (close >= end) break;
    cur = clampToBusiness(close);
  }
  return total / 3_600_000;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: `pass 14`, `fail 0`.

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/retainer-sla.ts tests/retainer-sla.test.ts package.json
git commit -m "Add business-day SLA arithmetic for retainer response times"
```

---

### Task 2: SLA policy — tier + priority to deadline and outcome

**Files:**
- Create: `lib/retainer-types.ts`
- Create: `lib/retainer-policy.ts`
- Create: `tests/retainer-policy.test.ts`

**Interfaces:**
- Consumes: `addBusinessHours`, `businessHoursBetween` from `lib/retainer-sla` (Task 1).
- Produces:
  - `type RetainerPriority = "Urgent" | "High" | "Medium" | "Low"`
  - `type SlaOutcome = "Pending" | "Met" | "Breached" | "Not covered"`
  - `type RetainerTier = { id: string; name: string; rank: number; active: boolean; includedHours: number | null; monthlyRate: number | null; slaHours: Record<RetainerPriority, number | null>; slaLabel: string | null; maxUrgentPerMonth: number | null; clientDescription: string | null }`
  - `slaHoursFor(tier: RetainerTier | null, priority: RetainerPriority): number | null`
  - `computeSlaDueAt(tier: RetainerTier | null, priority: RetainerPriority, submittedAt: Date): Date | null`
  - `evaluateSlaOutcome(args: { dueAt: Date | null; firstRespondedAt: Date | null; now: Date }): SlaOutcome`
  - `slaRiskRatio(args: { submittedAt: Date; dueAt: Date | null; now: Date }): number | null`

- [ ] **Step 1: Write the client-safe types**

Create `lib/retainer-types.ts`:

```ts
// Client-safe retainer types. No "server-only" — imported by client components.

export const RETAINER_PRIORITIES = ["Urgent", "High", "Medium", "Low"] as const;
export type RetainerPriority = (typeof RETAINER_PRIORITIES)[number];

export const SLA_OUTCOMES = ["Pending", "Met", "Breached", "Not covered"] as const;
export type SlaOutcome = (typeof SLA_OUTCOMES)[number];

/** Client-facing request statuses. Deliberately distinct from Story Status. */
export const REQUEST_STATUSES = [
  "Submitted",
  "Acknowledged",
  "In Progress",
  "Awaiting Client",
  "Delivered",
  "Closed",
  "Declined",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RetainerTier = {
  id: string;
  name: string;
  rank: number;
  active: boolean;
  includedHours: number | null;
  monthlyRate: number | null;
  /** Business hours to first response, per priority. null = not covered. */
  slaHours: Record<RetainerPriority, number | null>;
  slaLabel: string | null;
  maxUrgentPerMonth: number | null;
  clientDescription: string | null;
};
```

- [ ] **Step 2: Write the failing test**

Create `tests/retainer-policy.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fromZoned, zonedParts } from "../lib/retainer-sla";
import { computeSlaDueAt, evaluateSlaOutcome, slaHoursFor, slaRiskRatio } from "../lib/retainer-policy";
import type { RetainerTier } from "../lib/retainer-types";

const fmt = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

const platinum: RetainerTier = {
  id: "recIaQ8Q51Czl98x7",
  name: "Platinum",
  rank: 5,
  active: true,
  includedHours: 45,
  monthlyRate: 6750,
  slaHours: { Urgent: 2, High: 4, Medium: 8, Low: 16 },
  slaLabel: "Same business day",
  maxUrgentPerMonth: 4,
  clientDescription: null,
};

const unfilled: RetainerTier = {
  ...platinum,
  id: "recFGCeWFGWsHl8pn",
  name: "Bronze",
  rank: 1,
  slaHours: { Urgent: null, High: null, Medium: null, Low: null },
};

test("slaHoursFor reads the column matching the priority", () => {
  assert.equal(slaHoursFor(platinum, "Urgent"), 2);
  assert.equal(slaHoursFor(platinum, "Low"), 16);
});

test("slaHoursFor returns null when there is no tier", () => {
  assert.equal(slaHoursFor(null, "Urgent"), null);
});

test("slaHoursFor returns null when the tier column is blank", () => {
  assert.equal(slaHoursFor(unfilled, "Urgent"), null);
});

test("computeSlaDueAt adds business hours from the tier", () => {
  const due = computeSlaDueAt(platinum, "High", fromZoned(2026, 8, 6, 10, 0));
  assert.equal(fmt(due!), "2026-08-06 14:00");
});

test("computeSlaDueAt returns null for an unfilled tier", () => {
  assert.equal(computeSlaDueAt(unfilled, "Urgent", fromZoned(2026, 8, 6, 10, 0)), null);
});

test("computeSlaDueAt returns null when no tier is linked", () => {
  assert.equal(computeSlaDueAt(null, "Urgent", fromZoned(2026, 8, 6, 10, 0)), null);
});

test("no due date is Not covered, never Breached", () => {
  assert.equal(
    evaluateSlaOutcome({ dueAt: null, firstRespondedAt: null, now: fromZoned(2030, 1, 1, 12, 0) }),
    "Not covered",
  );
});

test("responded before the deadline is Met", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: fromZoned(2026, 8, 6, 11, 0),
      now: fromZoned(2026, 8, 6, 15, 0),
    }),
    "Met",
  );
});

test("responded exactly on the deadline is Met", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: fromZoned(2026, 8, 6, 14, 0),
      now: fromZoned(2026, 8, 6, 15, 0),
    }),
    "Met",
  );
});

test("responded after the deadline is Breached", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: fromZoned(2026, 8, 6, 16, 0),
      now: fromZoned(2026, 8, 6, 17, 0),
    }),
    "Breached",
  );
});

test("unanswered but still inside the deadline is Pending", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: null,
      now: fromZoned(2026, 8, 6, 12, 0),
    }),
    "Pending",
  );
});

test("unanswered past the deadline is Breached", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: null,
      now: fromZoned(2026, 8, 6, 16, 0),
    }),
    "Breached",
  );
});

test("slaRiskRatio is 0.5 at the halfway point", () => {
  const ratio = slaRiskRatio({
    submittedAt: fromZoned(2026, 8, 6, 10, 0),
    dueAt: fromZoned(2026, 8, 6, 14, 0),
    now: fromZoned(2026, 8, 6, 12, 0),
  });
  assert.equal(Math.round(ratio! * 100) / 100, 0.5);
});

test("slaRiskRatio is null when there is no deadline", () => {
  assert.equal(
    slaRiskRatio({
      submittedAt: fromZoned(2026, 8, 6, 10, 0),
      dueAt: null,
      now: fromZoned(2026, 8, 6, 12, 0),
    }),
    null,
  );
});

test("slaRiskRatio does not exceed 1 once overdue", () => {
  const ratio = slaRiskRatio({
    submittedAt: fromZoned(2026, 8, 6, 10, 0),
    dueAt: fromZoned(2026, 8, 6, 14, 0),
    now: fromZoned(2026, 8, 20, 14, 0),
  });
  assert.equal(ratio, 1);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/retainer-policy'`.

- [ ] **Step 4: Write the implementation**

Create `lib/retainer-policy.ts`:

```ts
// Maps a retainer tier + client priority to an SLA deadline and outcome.
//
// PURE MODULE — no I/O. Duplicated into airvues-retainer-portal alongside
// lib/retainer-sla.ts.
//
// Degradation rule: no tier, or a blank SLA column, yields "Not covered".
// "Not covered" MUST NEVER become "Breached" — that is what allows the portal
// to ship before management has filled the tier table.

import { addBusinessHours, businessHoursBetween } from "./retainer-sla";
import type { RetainerPriority, RetainerTier, SlaOutcome } from "./retainer-types";

/** Business hours allowed for this priority, or null if not covered. */
export function slaHoursFor(tier: RetainerTier | null, priority: RetainerPriority): number | null {
  if (!tier) return null;
  const h = tier.slaHours[priority];
  return typeof h === "number" && h > 0 ? h : null;
}

/** Deadline for a first human response, or null when not covered. */
export function computeSlaDueAt(
  tier: RetainerTier | null,
  priority: RetainerPriority,
  submittedAt: Date,
): Date | null {
  const hours = slaHoursFor(tier, priority);
  if (hours === null) return null;
  return addBusinessHours(submittedAt, hours);
}

export function evaluateSlaOutcome(args: {
  dueAt: Date | null;
  firstRespondedAt: Date | null;
  now: Date;
}): SlaOutcome {
  const { dueAt, firstRespondedAt, now } = args;
  if (!dueAt) return "Not covered";
  if (firstRespondedAt) return firstRespondedAt <= dueAt ? "Met" : "Breached";
  return now > dueAt ? "Breached" : "Pending";
}

/**
 * How much of the SLA window has elapsed, 0..1. Used to flag "at risk"
 * (>= 0.75) on the manager board. null when not covered.
 */
export function slaRiskRatio(args: {
  submittedAt: Date;
  dueAt: Date | null;
  now: Date;
}): number | null {
  const { submittedAt, dueAt, now } = args;
  if (!dueAt) return null;
  const total = businessHoursBetween(submittedAt, dueAt);
  if (total <= 0) return 1;
  const elapsed = businessHoursBetween(submittedAt, now);
  return Math.min(1, elapsed / total);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: `pass 29`, `fail 0` (14 from Task 1 + 15 here).

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/retainer-types.ts lib/retainer-policy.ts tests/retainer-policy.test.ts
git commit -m "Add retainer SLA policy: tier + priority to deadline and outcome"
```

---

### Task 3: Airtable read layer for tiers and agreements

**Files:**
- Create: `lib/retainers.ts`
- Create: `scripts/server-only-stub.cjs` (dev-only preload; see Step 4)

**Interfaces:**
- Consumes: `RetainerTier`, `RetainerPriority` from `lib/retainer-types` (Task 2); `listRecordsCached` from `lib/airtable`; `Tables` from `lib/schema`.
- Produces:
  - `listRetainerTiers(): Promise<RetainerTier[]>` — sorted by `rank`, active only
  - `type RetainerAgreement = { id: string; projectName: string; companyId: string | null; companyName: string | null; tierId: string | null; monthlyRate: number | null; includedHours: number | null; termMonths: number | null; effectiveDate: string | null; subscriptionActive: boolean; dealStatus: string | null }`
  - `listRetainerAgreements(): Promise<RetainerAgreement[]>` — only quotes with a `Company` link
  - `currentPeriod(effectiveDate: string | null, now: Date): { start: Date; end: Date } | null`

There is no test in this task. It is a thin mapping layer over `listRecordsCached`, and testing it would require mocking Airtable — cost without signal. The pure logic it contains (`currentPeriod`) is exercised through Plan 2's board.

- [ ] **Step 1: Write the implementation**

Create `lib/retainers.ts`:

```ts
// Server-only Airtable reads for retainer agreements and their tiers.
// Do NOT import from a client component — this pulls in lib/airtable.ts.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { fromZoned, zonedParts } from "./retainer-sla";
import type { RetainerPriority, RetainerTier } from "./retainer-types";

const TIER = Tables.RetainerTiers;
const QUOTE = Tables.Quotes;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function firstLink(v: unknown): string | null {
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
}

/** Active tiers, ordered by rank. Blank SLA columns stay null — not zero. */
export async function listRetainerTiers(): Promise<RetainerTier[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    TIER.id,
    {
      fields: [
        TIER.fields["Tier Name"].id,
        TIER.fields["Rank"].id,
        TIER.fields["Active"].id,
        TIER.fields["Included Hours"].id,
        TIER.fields["Monthly Rate"].id,
        TIER.fields["SLA — Urgent (business hrs)"].id,
        TIER.fields["SLA — High (business hrs)"].id,
        TIER.fields["SLA — Medium (business hrs)"].id,
        TIER.fields["SLA — Low (business hrs)"].id,
        TIER.fields["SLA Label (client-facing)"].id,
        TIER.fields["Max Urgent / Month"].id,
        TIER.fields["Client-facing Description"].id,
      ],
    },
    ["retainers:tiers"],
  );

  const tiers: RetainerTier[] = rows.map((r) => {
    const f = r.fields;
    const slaHours: Record<RetainerPriority, number | null> = {
      Urgent: num(f["SLA — Urgent (business hrs)"]),
      High: num(f["SLA — High (business hrs)"]),
      Medium: num(f["SLA — Medium (business hrs)"]),
      Low: num(f["SLA — Low (business hrs)"]),
    };
    return {
      id: r.id,
      name: str(f["Tier Name"]) ?? "(unnamed)",
      rank: num(f["Rank"]) ?? 999,
      active: f["Active"] === true,
      includedHours: num(f["Included Hours"]),
      monthlyRate: num(f["Monthly Rate"]),
      slaHours,
      slaLabel: str(f["SLA Label (client-facing)"]),
      maxUrgentPerMonth: num(f["Max Urgent / Month"]),
      clientDescription: str(f["Client-facing Description"]),
    };
  });

  return tiers.filter((t) => t.active).sort((a, b) => a.rank - b.rank);
}

export type RetainerAgreement = {
  id: string;
  projectName: string;
  companyId: string | null;
  companyName: string | null;
  tierId: string | null;
  monthlyRate: number | null;
  includedHours: number | null;
  termMonths: number | null;
  effectiveDate: string | null;
  subscriptionActive: boolean;
  dealStatus: string | null;
};

/**
 * Retainer Agreement quotes. Only rows carrying a Company link are returned —
 * Company is the portal tenant key and an agreement without one is
 * unscopable, so it is invisible by design rather than leaked to everyone.
 */
export async function listRetainerAgreements(): Promise<RetainerAgreement[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    QUOTE.id,
    {
      fields: [
        QUOTE.fields["Project Name"].id,
        QUOTE.fields["Company"].id,
        QUOTE.fields["Client Name"].id,
        QUOTE.fields["Retainer Tier"].id,
        QUOTE.fields["Retainer Selected Monthly Rate"].id,
        QUOTE.fields["Retainer Selected Hours"].id,
        QUOTE.fields["Retainer Initial Term Months"].id,
        QUOTE.fields["Retainer Effective Date"].id,
        QUOTE.fields["Retainer Subscription Active"].id,
        QUOTE.fields["Status"].id,
      ],
      filterByFormula: `{Proposal Type} = 'Retainer Agreement'`,
    },
    ["retainers:agreements"],
  );

  return rows
    .map((r) => {
      const f = r.fields;
      const names = f["Client Name"];
      return {
        id: r.id,
        projectName: str(f["Project Name"]) ?? "(no name)",
        companyId: firstLink(f["Company"]),
        companyName: Array.isArray(names) && typeof names[0] === "string" ? names[0] : null,
        tierId: firstLink(f["Retainer Tier"]),
        monthlyRate: num(f["Retainer Selected Monthly Rate"]),
        includedHours: num(f["Retainer Selected Hours"]),
        termMonths: num(f["Retainer Initial Term Months"]),
        effectiveDate: str(f["Retainer Effective Date"]),
        subscriptionActive: f["Retainer Subscription Active"] === "Active",
        dealStatus: str(f["Status"]),
      };
    })
    .filter((a) => a.companyId !== null);
}

/**
 * The billing period containing `now`, anchored on the anniversary day of
 * effectiveDate (NOT the calendar month) so hours stay aligned with the Stripe
 * subscription date. A day-of-month past the end of a short month clamps to
 * that month's last day.
 */
export function currentPeriod(
  effectiveDate: string | null,
  now: Date,
): { start: Date; end: Date } | null {
  if (!effectiveDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate);
  if (!m) return null;
  const anchorDay = +m[3];

  const p = zonedParts(now);
  const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const startOf = (y: number, mo: number) =>
    fromZoned(y, mo, Math.min(anchorDay, daysInMonth(y, mo)), 0, 0);

  let sy = p.year;
  let sm = p.month;
  if (now < startOf(sy, sm)) {
    sm -= 1;
    if (sm === 0) {
      sm = 12;
      sy -= 1;
    }
  }
  let ey = sy;
  let em = sm + 1;
  if (em === 13) {
    em = 1;
    ey += 1;
  }
  return { start: startOf(sy, sm), end: startOf(ey, em) };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. If a field name fails to resolve on `Tables.RetainerTiers` or `Tables.Quotes`, run `node scripts/regenerate-schema.mjs` — the em-dash in `SLA — Urgent (business hrs)` is byte-sensitive and must match the live base exactly.

- [ ] **Step 3: Verify schema and build**

Run: `npm run verify-schema && npm run build`
Expected: both exit 0.

- [ ] **Step 4: Smoke-test the reads against the live base**

`lib/retainers.ts` cannot be imported by a bare Node script as-is. Two Next-only
constraints block it, and both must be neutralised:

1. `import "server-only"` throws unless resolved under the `react-server` export
   condition. Do **not** reach for `--conditions=react-server` — it also flips
   React to its server subset, which throws
   `This entry point is not yet supported outside of experimental channels`.
2. `unstable_cache` throws `Invariant: incrementalCache missing` with no Next
   request context.

First create `scripts/server-only-stub.cjs`:

```js
// Dev-only preload that lets modules under lib/ be exercised from a plain Node
// script (smoke tests, dry runs) instead of only inside a Next request.
//
//   node --require ./scripts/server-only-stub.cjs --import tsx ./some-script.ts
//
// NEVER load this from application code — it defeats a real safety marker and
// silently disables caching.

const path = require("node:path");

// --- 1. server-only -> empty module -------------------------------------
const resolved = require.resolve("server-only");
require.cache[resolved] = {
  id: resolved,
  filename: resolved,
  path: path.dirname(resolved),
  loaded: true,
  children: [],
  paths: [],
  exports: {},
};

// --- 2. unstable_cache -> pass-through ----------------------------------
// Patched before lib/* is loaded, so the app's import picks up the stub.
try {
  const nextCache = require("next/cache");
  Object.defineProperty(nextCache, "unstable_cache", {
    value: (fn) => fn,
    configurable: true,
    writable: true,
  });
} catch (err) {
  console.warn("[server-only-stub] could not patch next/cache:", err.message);
}
```

Then run the smoke script. Note the extension is `.ts`, **not** `.mts` — tsx
compiles `lib/` to CJS (there is no `"type": "module"`), and an `.mts` importer
is ESM, so Node's lexer fails to see some named exports and reports
`does not provide an export named 'currentPeriod'`.

```bash
cat > ./retainer-smoke.ts <<'EOF'
import { listRetainerAgreements, listRetainerTiers, currentPeriod } from "./lib/retainers";
async function main() {
  const tiers = await listRetainerTiers();
  console.log("tiers:", tiers.length);
  for (const t of tiers) console.log(`  ${t.rank} ${t.name} hrs=${t.includedHours ?? "-"} rate=${t.monthlyRate ?? "-"} sla=${JSON.stringify(t.slaHours)}`);
  const ags = await listRetainerAgreements();
  console.log("agreements (Company link present):", ags.length);
  for (const a of ags) {
    const p = currentPeriod(a.effectiveDate, new Date());
    console.log(`  ${a.projectName} company=${a.companyId} tier=${a.tierId ?? "null"} eff=${a.effectiveDate ?? "-"}`);
    if (p) console.log(`     period: ${p.start.toISOString().slice(0, 10)} -> ${p.end.toISOString().slice(0, 10)}`);
  }
}
main();
EOF
set -a; source .env.local; set +a
node --require ./scripts/server-only-stub.cjs --import tsx ./retainer-smoke.ts
rm -f ./retainer-smoke.ts
```

Expected: 7 tiers with all-null `slaHours` (until management fills them),
Platinum showing `hrs=45 rate=6750`, and **3** agreements — Gracie Barra with
`tier=recIaQ8Q51Czl98x7`, the other two `tier=null`. Gracie Barra's period must
span the 16th to the 16th (e.g. `2026-07-16 -> 2026-08-16`), matching its
2026-06-16 effective date.

- [ ] **Step 5: Commit**

```bash
git add lib/retainers.ts
git commit -m "Add server-only Airtable read layer for retainer tiers and agreements"
```

---

## Self-review notes

- **Spec coverage.** This plan implements spec §5 (SLA engine) and the tier/agreement reads that §8 and §7 consume. Spec §6 (client identity), §7 (portal surface), §8 (internal surfaces) and §9's notification work are Plans 2–4.
- **Deliberate omission.** No unit test covers `lib/retainers.ts`; it is I/O mapping whose only pure function (`currentPeriod`) is covered by the Step 4 smoke test and exercised in Plan 2. Flagged rather than silently skipped.
- **Known gap carried forward.** `Request Number` (autoNumber + formula) still must be added in the Airtable UI — the Meta API cannot create those field types. It is not needed by this plan.
- **Verified, not assumed.** Every assertion in Tasks 1 and 2 was executed against this exact implementation before the plan was written; the `nextDayStart` UTC-conversion bug and the exact-close boundary rule were both found that way.

---

## Follow-on plans

| Plan | Scope | Blocked on |
|---|---|---|
| 2 | Internal surfaces — `/retainers` board, deep dive, dev inbox, triage → Story | This plan |
| 3 | Client identity — new `airvues-retainer-portal` repo, Vercel project + URL, email provisioning, magic link, invites, Company scoping | Schema (done); needs Vercel CLI ≥58 |
| 4 | Client portal — agreement view, submit, thread, notifications | Plans 1–3 |
