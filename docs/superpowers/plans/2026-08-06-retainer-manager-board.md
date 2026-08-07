# Retainer Manager Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/retainers` — a read-only cross-retainer health board answering "which retainer is at risk?" — on top of the SLA engine from Plan 1.

**Architecture:** Three layers. `lib/retainer-requests.ts` reads requests from Airtable (`server-only`). `lib/retainer-board.ts` is pure aggregation — it takes already-fetched requests, agreements, tiers and a `now`, and returns board rows; because it has no I/O it is fully unit-tested. `app/(app)/retainers/page.tsx` plus one client component renders it.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · `node:test` via existing `tsx` · Airtable REST via `lib/airtable.ts` · Tailwind with the existing design tokens.

**Spec:** `docs/superpowers/specs/2026-08-06-retainer-portal-design.md` §8
**Depends on:** Plan 1 (`docs/superpowers/plans/2026-08-06-retainer-sla-engine.md`) — merged as PR #1

## Scope note — narrower than spec §8, deliberately

Spec §8 bundles four internal surfaces: health board, per-retainer deep dive, dev
inbox, and request→Story triage. This plan ships **only the board**, which is
read-only and therefore needs no mutations. Deep dive, thread, triage and dev
inbox all require writes and become Plan 2b.

The split is not arbitrary: a read-only board is independently useful the moment
a single request exists, and it is the surface that proves the SLA aggregation is
correct before any code is allowed to *write* an SLA outcome.

## Global Constraints

- **No new runtime dependencies.**
- **Never import `lib/airtable.ts` from a client component.** Page is a Server Component; it passes plain data down.
- **Field access via `lib/schema.ts` IDs.** Never hardcode `fld…`. Regenerate with `node scripts/regenerate-schema.mjs` if a name fails to resolve.
- **`lib/retainer-board.ts` must be pure** — no I/O, no Airtable, no Next. It takes `now: Date` as a parameter and must never call `new Date()` internally, or it cannot be tested.
- **A `Not covered` request is never counted as breached or at-risk.** Carried from Plan 1.
- **Route gating:** `assertCanAccess("/retainers")` at the top of the page. Nav hiding is cosmetic.
- **Verification gate for every task:** `npm test`, `npx tsc --noEmit`, `npm run build` all exit 0.

## Two decisions that deviate from the spec

**1. Gate behind the existing `Delivery` permission, not a new `Retainers` one.**
Spec §8 calls for a dedicated permission. Adding one means adding a `Retainers`
option to the `People.Permissions` multi-select in Airtable *and* editing each
manager's record — until which point the page is invisible to everyone,
including whoever just built it. `Delivery` is already held by exactly the
leadership set (Shania, Lee, Cody, Jose, David). Splitting a dedicated
permission out later is a two-line change in `lib/permissions.ts`.

**2. Hours-logged is shown, with an explicit staleness label.**
Spec §9 defers the hours gauge because `Stories.Hours` is back-filled — Gracie
Barra's stories were created 2026-08-03 carrying June/July completion dates. That
deferral is about the **client** portal, where 0 hours reads as "you did nothing".
An internal manager knows the difference between "not logged" and "not worked",
so the board shows it under a `logged, may lag` label rather than hiding a number
managers will ask for.

## File Structure

| File | Responsibility |
|---|---|
| `lib/retainer-types.ts` | **Modify.** Add `RetainerRequest`, `RetainerBoardRow`. |
| `lib/retainer-requests.ts` | **Create.** `server-only` Airtable reads for requests + period hours. |
| `lib/retainer-board.ts` | **Create.** Pure aggregation. Requests + agreements + tiers → board rows. |
| `tests/retainer-board.test.ts` | **Create.** Aggregation, at-risk, breach counting, degradation. |
| `app/(app)/retainers/page.tsx` | **Create.** Server Component; fetch, guard, render. |
| `components/retainers/RetainerBoard.tsx` | **Create.** Client component — sort + filter + rows. |
| `lib/nav.ts` | **Modify.** Add the `/retainers` entry. |
| `lib/permissions.ts` | **Modify.** Map `retainers` → `Delivery`. |

---

### Task 1: Request reads + board types

**Files:**
- Modify: `lib/retainer-types.ts`
- Create: `lib/retainer-requests.ts`

**Interfaces:**
- Consumes: `RetainerPriority`, `RequestStatus`, `SlaOutcome` from `lib/retainer-types`; `listRecordsCached` from `lib/airtable`; `Tables` from `lib/schema`; `currentPeriod` from `lib/retainers`.
- Produces:
  - `type RetainerRequest = { id: string; title: string; retainerId: string | null; companyId: string | null; submittedById: string | null; priority: RetainerPriority | null; status: RequestStatus | null; submittedAt: string | null; slaDueAt: string | null; firstRespondedAt: string | null; slaOutcome: SlaOutcome | null; assignedToId: string | null; storyIds: string[]; closedAt: string | null }`
  - `listRetainerRequests(): Promise<RetainerRequest[]>`
  - `hoursByRetainerInPeriod(retainerIds: string[], now: Date): Promise<Record<string, number>>`

- [ ] **Step 1: Add the types**

Append to `lib/retainer-types.ts`:

```ts
/** A client-submitted retainer request. Dates are ISO strings (client-safe). */
export type RetainerRequest = {
  id: string;
  title: string;
  retainerId: string | null;
  companyId: string | null;
  submittedById: string | null;
  priority: RetainerPriority | null;
  status: RequestStatus | null;
  submittedAt: string | null;
  slaDueAt: string | null;
  firstRespondedAt: string | null;
  slaOutcome: SlaOutcome | null;
  assignedToId: string | null;
  storyIds: string[];
  closedAt: string | null;
};

/** One row of the /retainers health board. */
export type RetainerBoardRow = {
  retainerId: string;
  projectName: string;
  companyId: string | null;
  companyName: string | null;
  tierName: string | null;
  slaLabel: string | null;
  subscriptionActive: boolean;
  /** Requests not yet Closed or Declined. */
  openCount: number;
  /** Open, unanswered, and past their deadline. */
  breachedNowCount: number;
  /** Open, unanswered, >=75% of the window elapsed, not yet breached. */
  atRiskCount: number;
  /** Breached at any point during the current period, answered or not. */
  breachedThisPeriodCount: number;
  /** Business hours the oldest unanswered open request has been waiting. */
  oldestUnansweredHours: number | null;
  includedHours: number | null;
  /** Sum of Stories.Hours completed inside the current period. May lag. */
  hoursLoggedThisPeriod: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** Sort key: higher is worse. Breaches dominate, then risk, then wait time. */
  severity: number;
};

/** Open statuses — everything except the two terminal ones. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  "Submitted",
  "Acknowledged",
  "In Progress",
  "Awaiting Client",
  "Delivered",
];
```

- [ ] **Step 2: Write the reads**

Create `lib/retainer-requests.ts`:

```ts
// Server-only Airtable reads for retainer requests.
// Do NOT import from a client component.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { currentPeriod } from "./retainers";
import type {
  RetainerPriority,
  RequestStatus,
  RetainerRequest,
  SlaOutcome,
} from "./retainer-types";

const REQ = Tables.RetainerRequests;
const STORY = Tables.Stories;
const QUOTE = Tables.Quotes;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function firstLink(v: unknown): string | null {
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
}
function links(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function listRetainerRequests(): Promise<RetainerRequest[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    REQ.id,
    {
      fields: [
        REQ.fields["Title"].id,
        REQ.fields["Retainer"].id,
        REQ.fields["Company"].id,
        REQ.fields["Submitted By"].id,
        REQ.fields["Client Priority"].id,
        REQ.fields["Status"].id,
        REQ.fields["Submitted At"].id,
        REQ.fields["SLA Due At"].id,
        REQ.fields["First Responded At"].id,
        REQ.fields["SLA Outcome"].id,
        REQ.fields["Assigned To"].id,
        REQ.fields["Stories"].id,
        REQ.fields["Closed At"].id,
      ],
    },
    ["retainers:requests"],
  );

  return rows.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      title: str(f["Title"]) ?? "(untitled)",
      retainerId: firstLink(f["Retainer"]),
      companyId: firstLink(f["Company"]),
      submittedById: firstLink(f["Submitted By"]),
      priority: (str(f["Client Priority"]) as RetainerPriority | null) ?? null,
      status: (str(f["Status"]) as RequestStatus | null) ?? null,
      submittedAt: str(f["Submitted At"]),
      slaDueAt: str(f["SLA Due At"]),
      firstRespondedAt: str(f["First Responded At"]),
      slaOutcome: (str(f["SLA Outcome"]) as SlaOutcome | null) ?? null,
      assignedToId: firstLink(f["Assigned To"]),
      storyIds: links(f["Stories"]),
      closedAt: str(f["Closed At"]),
    };
  });
}

/**
 * Sum of Stories.Hours per retainer quote, for stories whose Completed Date
 * falls inside that retainer's current anniversary period.
 *
 * CAVEAT: Stories are frequently back-filled weeks after the work — a low
 * number means "not logged yet", not "not worked". Label it as such in any UI.
 */
export async function hoursByRetainerInPeriod(
  retainerIds: string[],
  now: Date,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (retainerIds.length === 0) return out;

  const quotes = await listRecordsCached<Record<string, unknown>>(
    QUOTE.id,
    { fields: [QUOTE.fields["Retainer Effective Date"].id] },
    ["retainers:agreements"],
  );
  const effectiveById = new Map(
    quotes.map((q) => [q.id, str(q.fields["Retainer Effective Date"])]),
  );

  const stories = await listRecordsCached<Record<string, unknown>>(
    STORY.id,
    {
      fields: [
        STORY.fields["Quote"].id,
        STORY.fields["Hours"].id,
        STORY.fields["Completed Date"].id,
      ],
      filterByFormula: `AND({Story Status} = 'Completed', {Completed Date} != BLANK())`,
    },
    ["retainers:period-hours"],
  );

  const wanted = new Set(retainerIds);
  for (const s of stories) {
    const quoteId = firstLink(s.fields["Quote"]);
    if (!quoteId || !wanted.has(quoteId)) continue;
    const completed = str(s.fields["Completed Date"]);
    if (!completed) continue;
    const period = currentPeriod(effectiveById.get(quoteId) ?? null, now);
    if (!period) continue;
    const when = new Date(`${completed}T12:00:00Z`);
    if (when < period.start || when >= period.end) continue;
    const hours = typeof s.fields["Hours"] === "number" ? (s.fields["Hours"] as number) : 0;
    out[quoteId] = (out[quoteId] ?? 0) + hours;
  }
  return out;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/retainer-types.ts lib/retainer-requests.ts
git commit -m "Add retainer request reads and board row types"
```

---

### Task 2: Board aggregation (pure)

**Files:**
- Create: `lib/retainer-board.ts`
- Create: `tests/retainer-board.test.ts`

**Interfaces:**
- Consumes: `businessHoursBetween` from `lib/retainer-sla`; `evaluateSlaOutcome`, `slaRiskRatio` from `lib/retainer-policy`; `RetainerAgreement`, `currentPeriod` from `lib/retainers`; `RetainerRequest`, `RetainerTier`, `RetainerBoardRow`, `OPEN_REQUEST_STATUSES` from `lib/retainer-types`.
- Produces:
  - `buildBoardRows(args: { agreements: RetainerAgreement[]; tiers: RetainerTier[]; requests: RetainerRequest[]; hoursByRetainer: Record<string, number>; now: Date }): RetainerBoardRow[]`

- [ ] **Step 1: Write the failing test**

Create `tests/retainer-board.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoardRows } from "../lib/retainer-board";
import { fromZoned } from "../lib/retainer-sla";
import type { RetainerRequest, RetainerTier } from "../lib/retainer-types";

const NOW = fromZoned(2026, 8, 6, 14, 0);

const platinum: RetainerTier = {
  id: "tier1",
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

const blankTier: RetainerTier = {
  ...platinum,
  id: "tier2",
  name: "Bronze",
  slaHours: { Urgent: null, High: null, Medium: null, Low: null },
};

const agreement = {
  id: "q1",
  projectName: "Gracie Barra Retainer",
  companyId: "co1",
  companyName: "Gracie Barra",
  tierId: "tier1",
  monthlyRate: 6750,
  includedHours: 45,
  termMonths: 3,
  effectiveDate: "2026-06-16",
  subscriptionActive: true,
  dealStatus: "Approved and Signed",
};

function req(over: Partial<RetainerRequest>): RetainerRequest {
  return {
    id: "r" + Math.abs(over.title?.length ?? 1),
    title: "t",
    retainerId: "q1",
    companyId: "co1",
    submittedById: null,
    priority: "High",
    status: "Submitted",
    submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
    slaDueAt: fromZoned(2026, 8, 6, 14, 0).toISOString(),
    firstRespondedAt: null,
    slaOutcome: "Pending",
    assignedToId: null,
    storyIds: [],
    closedAt: null,
    ...over,
  };
}

const base = { agreements: [agreement], tiers: [platinum], hoursByRetainer: {}, now: NOW };

test("a retainer with no requests still gets a row", () => {
  const rows = buildBoardRows({ ...base, requests: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].openCount, 0);
  assert.equal(rows[0].severity, 0);
});

test("resolves tier name and SLA label onto the row", () => {
  const rows = buildBoardRows({ ...base, requests: [] });
  assert.equal(rows[0].tierName, "Platinum");
  assert.equal(rows[0].slaLabel, "Same business day");
});

test("counts open requests and excludes Closed and Declined", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [
      req({ id: "a", status: "Submitted" }),
      req({ id: "b", status: "In Progress" }),
      req({ id: "c", status: "Closed" }),
      req({ id: "d", status: "Declined" }),
    ],
  });
  assert.equal(rows[0].openCount, 2);
});

test("an unanswered request past its deadline counts as breached now", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", slaDueAt: fromZoned(2026, 8, 6, 11, 0).toISOString() })],
  });
  assert.equal(rows[0].breachedNowCount, 1);
  assert.equal(rows[0].atRiskCount, 0);
});

test("an unanswered request past 75 percent of its window is at risk", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [
      req({
        id: "a",
        submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
        slaDueAt: fromZoned(2026, 8, 6, 15, 0).toISOString(),
      }),
    ],
  });
  assert.equal(rows[0].atRiskCount, 1);
  assert.equal(rows[0].breachedNowCount, 0);
});

test("an answered request is neither at risk nor breached now", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [
      req({
        id: "a",
        slaDueAt: fromZoned(2026, 8, 6, 11, 0).toISOString(),
        firstRespondedAt: fromZoned(2026, 8, 6, 10, 30).toISOString(),
      }),
    ],
  });
  assert.equal(rows[0].breachedNowCount, 0);
  assert.equal(rows[0].atRiskCount, 0);
});

test("a Not covered request is never breached or at risk", () => {
  const rows = buildBoardRows({
    ...base,
    tiers: [blankTier],
    agreements: [{ ...agreement, tierId: "tier2" }],
    requests: [req({ id: "a", slaDueAt: null, slaOutcome: "Not covered" })],
  });
  assert.equal(rows[0].breachedNowCount, 0);
  assert.equal(rows[0].atRiskCount, 0);
  assert.equal(rows[0].openCount, 1);
});

test("a retainer with no tier linked still renders, with null tier name", () => {
  const rows = buildBoardRows({ ...base, agreements: [{ ...agreement, tierId: null }], requests: [] });
  assert.equal(rows[0].tierName, null);
  assert.equal(rows[0].slaLabel, null);
});

test("oldest unanswered wait is measured in business hours", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString() })],
  });
  assert.equal(rows[0].oldestUnansweredHours, 4);
});

test("oldest unanswered is null when everything is answered", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", firstRespondedAt: fromZoned(2026, 8, 6, 11, 0).toISOString() })],
  });
  assert.equal(rows[0].oldestUnansweredHours, null);
});

test("period is the anniversary window, not the calendar month", () => {
  const rows = buildBoardRows({ ...base, requests: [] });
  assert.equal(rows[0].periodStart?.slice(0, 10), "2026-07-16");
  assert.equal(rows[0].periodEnd?.slice(0, 10), "2026-08-16");
});

test("logged hours pass through from the supplied map", () => {
  const rows = buildBoardRows({ ...base, requests: [], hoursByRetainer: { q1: 31.5 } });
  assert.equal(rows[0].hoursLoggedThisPeriod, 31.5);
});

test("breaches sort above at-risk, which sorts above quiet retainers", () => {
  const second = { ...agreement, id: "q2", projectName: "Quiet Co", companyId: "co2" };
  const rows = buildBoardRows({
    ...base,
    agreements: [second, agreement],
    requests: [req({ id: "a", slaDueAt: fromZoned(2026, 8, 6, 11, 0).toISOString() })],
  });
  assert.equal(rows[0].retainerId, "q1");
  assert.ok(rows[0].severity > rows[1].severity);
});

test("requests belonging to another retainer are not counted", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", retainerId: "someone-else" })],
  });
  assert.equal(rows[0].openCount, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/retainer-board'`.

- [ ] **Step 3: Write the implementation**

Create `lib/retainer-board.ts`:

```ts
// Pure aggregation for the /retainers health board.
//
// NO I/O. `now` is a parameter, never `new Date()` internally — otherwise this
// cannot be tested and the board becomes unverifiable.

import { businessHoursBetween } from "./retainer-sla";
import { slaRiskRatio } from "./retainer-policy";
import { currentPeriod, type RetainerAgreement } from "./retainers";
import {
  OPEN_REQUEST_STATUSES,
  type RetainerBoardRow,
  type RetainerRequest,
  type RetainerTier,
} from "./retainer-types";

/** Fraction of the SLA window elapsed at which a request is "at risk". */
export const AT_RISK_THRESHOLD = 0.75;

function isOpen(r: RetainerRequest): boolean {
  return r.status !== null && OPEN_REQUEST_STATUSES.includes(r.status);
}

export function buildBoardRows(args: {
  agreements: RetainerAgreement[];
  tiers: RetainerTier[];
  requests: RetainerRequest[];
  hoursByRetainer: Record<string, number>;
  now: Date;
}): RetainerBoardRow[] {
  const { agreements, tiers, requests, hoursByRetainer, now } = args;
  const tierById = new Map(tiers.map((t) => [t.id, t]));

  const byRetainer = new Map<string, RetainerRequest[]>();
  for (const r of requests) {
    if (!r.retainerId) continue;
    const list = byRetainer.get(r.retainerId);
    if (list) list.push(r);
    else byRetainer.set(r.retainerId, [r]);
  }

  const rows = agreements.map((a): RetainerBoardRow => {
    const tier = a.tierId ? (tierById.get(a.tierId) ?? null) : null;
    const mine = byRetainer.get(a.id) ?? [];
    const open = mine.filter(isOpen);
    const period = currentPeriod(a.effectiveDate, now);

    let breachedNowCount = 0;
    let atRiskCount = 0;
    let oldestUnansweredHours: number | null = null;

    for (const r of open) {
      const submittedAt = r.submittedAt ? new Date(r.submittedAt) : null;
      const dueAt = r.slaDueAt ? new Date(r.slaDueAt) : null;
      const answered = !!r.firstRespondedAt;

      if (!answered && submittedAt) {
        const waited = businessHoursBetween(submittedAt, now);
        if (oldestUnansweredHours === null || waited > oldestUnansweredHours) {
          oldestUnansweredHours = waited;
        }
      }

      // No deadline => "Not covered". Never breached, never at risk.
      if (!dueAt || answered) continue;

      if (now > dueAt) {
        breachedNowCount += 1;
      } else if (submittedAt) {
        const ratio = slaRiskRatio({ submittedAt, dueAt, now });
        if (ratio !== null && ratio >= AT_RISK_THRESHOLD) atRiskCount += 1;
      }
    }

    // Breached at any point this period, whether or not it was answered later.
    const breachedThisPeriodCount = mine.filter((r) => {
      if (r.slaOutcome !== "Breached") return false;
      if (!period || !r.submittedAt) return true;
      const at = new Date(r.submittedAt);
      return at >= period.start && at < period.end;
    }).length;

    const severity =
      breachedNowCount * 1000 +
      atRiskCount * 100 +
      (oldestUnansweredHours ?? 0);

    return {
      retainerId: a.id,
      projectName: a.projectName,
      companyId: a.companyId,
      companyName: a.companyName,
      tierName: tier?.name ?? null,
      slaLabel: tier?.slaLabel ?? null,
      subscriptionActive: a.subscriptionActive,
      openCount: open.length,
      breachedNowCount,
      atRiskCount,
      breachedThisPeriodCount,
      oldestUnansweredHours,
      includedHours: a.includedHours ?? tier?.includedHours ?? null,
      hoursLoggedThisPeriod: hoursByRetainer[a.id] ?? null,
      periodStart: period ? period.start.toISOString() : null,
      periodEnd: period ? period.end.toISOString() : null,
      severity,
    };
  });

  return rows.sort(
    (x, y) => y.severity - x.severity || x.projectName.localeCompare(y.projectName),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: `pass 43`, `fail 0` (29 from Plan 1 + 14 here).

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/retainer-board.ts tests/retainer-board.test.ts
git commit -m "Add pure retainer board aggregation with SLA risk and breach counts"
```

---

### Task 3: The `/retainers` page

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `lib/nav.ts`
- Create: `components/retainers/RetainerBoard.tsx`
- Create: `app/(app)/retainers/page.tsx`

**Interfaces:**
- Consumes: `buildBoardRows` (Task 2); `listRetainerRequests`, `hoursByRetainerInPeriod` (Task 1); `listRetainerAgreements`, `listRetainerTiers` from `lib/retainers` (Plan 1); `PageHeader`, `StatCard` from `components/ui`.
- Produces: the route `/retainers`.

- [ ] **Step 1: Gate the route**

In `lib/permissions.ts`, add to the `ROUTE_PERMISSION` map, after the `clients` line:

```ts
  retainers: "Delivery",
```

- [ ] **Step 2: Add the nav entry**

In `lib/nav.ts`, inside `NAV_ITEMS`, immediately after the `/pipeline` entry:

```ts
  {
    href: "/retainers",
    label: "Retainers",
    desc: "Retainer health · open requests · SLA breaches · hours vs plan",
    group: "delivery",
    showInSidebar: true,
    showOnHome: true,
  },
```

- [ ] **Step 3: Write the board component**

Create `components/retainers/RetainerBoard.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RetainerBoardRow } from "@/lib/retainer-types";

const chip =
  "inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider";

function fmtHours(h: number | null): string {
  if (h === null) return "—";
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function periodLabel(row: RetainerBoardRow): string {
  if (!row.periodStart || !row.periodEnd) return "no effective date";
  const s = row.periodStart.slice(5, 10);
  const e = row.periodEnd.slice(5, 10);
  return `${s} → ${e}`;
}

export function RetainerBoard({ rows }: { rows: RetainerBoardRow[] }) {
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (attentionOnly && r.breachedNowCount === 0 && r.atRiskCount === 0) return false;
      if (!q) return true;
      return `${r.projectName} ${r.companyName ?? ""} ${r.tierName ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, attentionOnly]);

  if (rows.length === 0) {
    return (
      <section className="bg-surface border border-rule rounded-card px-4 py-10 text-center">
        <div className="text-[13px] text-ink-strong">No retainer agreements yet.</div>
        <div className="text-[12px] text-ink-muted mt-1">
          A quote appears here once its Proposal Type is “Retainer Agreement” and it has a
          Company link.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-rule rounded-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
        <div>
          <div className="eyebrow">Retainer health</div>
          <div className="text-[12px] text-ink-muted mt-0.5">
            {filtered.length} shown · {rows.length} total
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-ink-muted flex items-center gap-1.5 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
              className="accent-emerald"
            />
            Needs attention
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client or tier…"
            className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded-md focus:border-emerald focus:outline-none w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-ink-muted">
          Nothing matches. {attentionOnly && "No retainer is breached or at risk right now."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ink-faint border-b border-rule">
                <th className="text-left font-medium px-4 py-2">Retainer</th>
                <th className="text-left font-medium px-3 py-2">Tier</th>
                <th className="text-right font-medium px-3 py-2">Open</th>
                <th className="text-right font-medium px-3 py-2">Breached</th>
                <th className="text-right font-medium px-3 py-2">At risk</th>
                <th className="text-right font-medium px-3 py-2">Oldest wait</th>
                <th className="text-right font-medium px-3 py-2">
                  Hours
                  <div className="text-[9px] normal-case tracking-normal text-ink-faint">
                    logged, may lag
                  </div>
                </th>
                <th className="text-left font-medium px-3 py-2">Period</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.retainerId} className="border-b border-rule/50 hover:bg-bg-elevated">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/pipeline/${r.retainerId}`}
                      className="text-ink-strong hover:text-emerald font-medium"
                    >
                      {r.companyName ?? r.projectName}
                    </Link>
                    <div className="text-[11px] text-ink-muted truncate max-w-[280px]">
                      {r.projectName}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.tierName ? (
                      <>
                        <div className="text-ink">{r.tierName}</div>
                        {r.slaLabel && (
                          <div className="text-[10px] text-ink-faint">{r.slaLabel}</div>
                        )}
                      </>
                    ) : (
                      <span className={`${chip} bg-bg-elevated text-ink-muted`}>no tier</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink">{r.openCount}</td>
                  <td className="px-3 py-2.5 text-right tabnum">
                    {r.breachedNowCount > 0 ? (
                      <span className="text-red font-semibold">{r.breachedNowCount}</span>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum">
                    {r.atRiskCount > 0 ? (
                      <span className="text-amber font-semibold">{r.atRiskCount}</span>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink-muted">
                    {r.oldestUnansweredHours === null
                      ? "—"
                      : `${fmtHours(r.oldestUnansweredHours)}h`}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink-muted">
                    {fmtHours(r.hoursLoggedThisPeriod)}
                    {r.includedHours != null && (
                      <span className="text-ink-faint"> / {fmtHours(r.includedHours)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-ink-muted font-mono">
                    {periodLabel(r)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Write the page**

Create `app/(app)/retainers/page.tsx`:

```tsx
// Retainer health board — cross-retainer view answering "which retainer is at risk?".
// Read-only. Requests are created from the client portal (Plan 4) or ops triage (Plan 2b).
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { RetainerBoard } from "@/components/retainers/RetainerBoard";
import { assertCanAccess } from "@/lib/page-guard";
import { listRetainerAgreements, listRetainerTiers } from "@/lib/retainers";
import { hoursByRetainerInPeriod, listRetainerRequests } from "@/lib/retainer-requests";
import { buildBoardRows } from "@/lib/retainer-board";
import type { RetainerBoardRow } from "@/lib/retainer-types";

export const revalidate = 300;

export default async function RetainersRoute() {
  await assertCanAccess("/retainers");

  const now = new Date();
  let rows: RetainerBoardRow[] = [];
  let error: string | null = null;

  try {
    const [agreements, tiers, requests] = await Promise.all([
      listRetainerAgreements(),
      listRetainerTiers(),
      listRetainerRequests(),
    ]);
    const hoursByRetainer = await hoursByRetainerInPeriod(
      agreements.map((a) => a.id),
      now,
    );
    rows = buildBoardRows({ agreements, tiers, requests, hoursByRetainer, now });
  } catch (e) {
    error = (e as Error).message;
  }

  const totalOpen = rows.reduce((n, r) => n + r.openCount, 0);
  const totalBreached = rows.reduce((n, r) => n + r.breachedNowCount, 0);
  const totalAtRisk = rows.reduce((n, r) => n + r.atRiskCount, 0);
  const noTier = rows.filter((r) => r.tierName === null).length;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Retainers"
        subtitle="Which retainer is at risk. SLA clocks run 9am–6pm Mon–Fri Pacific."
        meta={
          <>
            <div className="font-mono tabnum">
              {rows.length} active retainer{rows.length === 1 ? "" : "s"}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">5-min cache</div>
          </>
        }
      />

      {error ? (
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load retainers: {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard label="Open requests" value={String(totalOpen)} />
            <StatCard
              label="Breached"
              value={String(totalBreached)}
              tone={totalBreached > 0 ? "red" : "neutral"}
              sub="past deadline, unanswered"
            />
            <StatCard
              label="At risk"
              value={String(totalAtRisk)}
              tone={totalAtRisk > 0 ? "amber" : "neutral"}
              sub="75% of window elapsed"
            />
            <StatCard
              label="No tier linked"
              value={String(noTier)}
              tone={noTier > 0 ? "amber" : "neutral"}
              sub="SLA not measured"
            />
          </div>
          <RetainerBoard rows={rows} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Typecheck, test, build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all exit 0; the build output lists `/retainers` as a route.

- [ ] **Step 6: Verify the page renders**

Run `npm run dev` with `DEV_PREVIEW=true` in `.env.local`, then:

```bash
curl -s -o /dev/null -w "%{http_code} /retainers\n" http://localhost:3000/retainers
```

Expected: `200`. With no requests in the base yet, the board shows all three
retainer rows with `Open 0`, `Breached 0`, `At risk 0`, and Gracie Barra showing
tier `Platinum` and period `07-16 → 08-16`. Dr. Bronner's and North London show
the `no tier` chip — that is correct, not a bug.

- [ ] **Step 7: Commit**

```bash
git add lib/permissions.ts lib/nav.ts components/retainers/RetainerBoard.tsx app/\(app\)/retainers/page.tsx
git commit -m "Add /retainers health board gated by the Delivery permission"
```

---

## Self-review notes

- **Spec coverage.** Implements spec §8's health board. Deep dive, dev inbox and triage are explicitly deferred to Plan 2b (see Scope note).
- **Two documented deviations.** `Delivery` permission instead of a new `Retainers` one; hours shown with a staleness label rather than hidden. Both argued above rather than made silently.
- **Testing boundary.** `lib/retainer-board.ts` is fully unit-tested because it is pure. The page and the client component are verified by build + a live render check — there is no React test setup in this repo, and adding jsdom + testing-library is out of scope here.
- **`buildBoardRows` takes `now` as a parameter.** If it ever calls `new Date()` internally the tests become time-dependent and will fail at 6pm Pacific. Worth guarding in review.

## Follow-on

| Plan | Scope | Blocked on |
|---|---|---|
| 2b | Deep dive `/retainers/[id]`, comment thread, request→Story triage, dev inbox on `/me`, request mutations | This plan |
| 3 | Separate portal repo + URL, email provisioning, magic link, invites | Vercel CLI ≥58; email service approval |
| 4 | Client portal surface + notifications | 2b, 3 |
