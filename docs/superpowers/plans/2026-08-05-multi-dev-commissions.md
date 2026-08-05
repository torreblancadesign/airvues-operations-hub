# Multi-Developer Story Commissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stories shared between developers pay each developer their own `People.Commission Percentage` of the full `Story.Cost` — reflected in the /engineering board math, visually flagged in story tables, and materialized as one Team Task Payment row per assignee when a story completes.

**Architecture:** Three layers. (1) Data: `lib/engineering.ts` computes per-assignee commission arrays from People rates; `Story.commission` becomes the firm's total liability (sum across assignees). (2) UI: a "Shared · N" chip in the shared `StoryTable`. (3) Money: a new server-only module `lib/completion-payments.ts` creates Team Task Payments rows (with duplicate guard + expense-batch routing) hooked into `updateStory`/`bulkUpdateStories` when status hits `Completed`, validated first by a read-only dry-run script.

**Tech Stack:** Next.js 14 Server Actions, Airtable REST via `lib/airtable.ts` (server-only), TypeScript strict.

## Global Constraints

- **Production Airtable base `app4vhhWMbRFOloOU` — real money.** No write may run until the dry-run script (Task 5) has been executed and its output reviewed.
- No test suite exists. Every task's gate is: `npx tsc --noEmit` exits 0; `npm run build` exits 0 for tasks that end a UI/data change; `npm run verify-schema` for Task 1.
- Field names/IDs come from `lib/schema.ts` only (rule #3/#12 in CLAUDE.md). Task 1 adds the missing entries with IDs verified against the live Meta API on 2026-08-05.
- `Story.Status` value is exactly `"Completed"`; payment `Status` is exactly `"Needs Payment"`; payment `Function` is exactly `"Engineer"`; expense `Status` is exactly `"Pending"`; expense `Type` is exactly `"Contractor Commissions"`.
- Commission percent normalization (copy of `lib/scorecard.ts` behavior): a number > 1 is a percentage (divide by 100), ≤ 1 is already a decimal; explicit `0` is honored (salaried, no commission → skip payment creation); missing → default `COMMISSION_RATE` (0.15).
- Rounding: `Math.round(n * 100) / 100` for every dollar amount.
- Duplicate guard is mandatory (user confirmed payment creation today is "mixed / not sure"): never create a payment for an assignee who already has a payment linked to the story (matched by expense-routed People recId OR payee email).
- Kill switch: env `DISABLE_COMPLETION_PAYMENTS=1` disables app-side payment creation entirely.
- All new writes go through `lib/airtable.ts` wrappers (`createRecords`, `patchRecords`) — never raw fetch.

## Verified live-schema reference (Meta API, 2026-08-05)

| Table | Field | ID | Type |
|---|---|---|---|
| Stories `tblgd7iKw2KdPBkn2` | 🔵 Team Task Payments | `fldjlCJCwOckeazEu` | multipleRecordLinks → payments |
| Stories | Assignee Commission Amount | `fldGpRvdPOc19UObC` | currency (plain field, NOT formula — leave it alone, an unknown existing flow writes it) |
| Stories | Commission Percentage (from Assignee) | `fldj02RRtwN360KzT` | lookup of People `fldC445d4d8lIjLGT` |
| Stories | Completed Date | `fldM6ApgoMtoQW7RW` | date (schema.ts has placeholder id `"Completed Date"`) |
| People `tbl9wvZY9M7Y7hcf1` | Commission Percentage | `fldC445d4d8lIjLGT` | percent |
| People | Airtable Account (a.k.a. "User") | `fldeo2BqLzQ5xfiXx` | multipleCollaborators (already in schema.ts) |
| TeamTaskPayments `tblvzdxVq7drJtobt` | Stories | `fldfu34ybjOyJbcfR` | multipleRecordLinks → stories |
| TeamTaskPayments | Amount / Function / Status / Payee / Link to Expenses / Comments | already in schema.ts | — |
| AirvuesExpenses `tblhQ9jkgVAuG97gg` | Internal Team Member Account | `fldFxPqnKgZYEP8M6` | link → People |
| AirvuesExpenses | Status | `fldILjXt6QmeYixoX` | singleSelect Paid/Failed/Pending |

Observed payment conventions (Job IDs 730–732): one row per payee; `Stories` may link several stories; `Amount` = sum of story commissions; `Payee` = collaborator `{id,email,name}`; `Link to Expenses` → the person's open `Status=Pending` expense batch named like `"Project Payments for <name>"`.

---

### Task 1: Add verified field IDs to lib/schema.ts

**Files:**
- Modify: `lib/schema.ts` (Stories fields block ~line with `"Completed Date"`, People fields block, TeamTaxPayments→TeamTaskPayments fields block, AirvuesExpenses block if `Status`/`Expense Name`/`Type` missing)

**Interfaces:**
- Produces: `Tables.Stories.fields["🔵 Team Task Payments"]`, `Tables.Stories.fields["Assignee Commission Amount"]`, `Tables.People.fields["Commission Percentage"]`, `Tables.TeamTaskPayments.fields["Stories"]` — used by Tasks 2 and 4.

- [ ] **Step 1: Fix the Completed Date placeholder in Stories**

In `lib/schema.ts` Stories fields, replace:
```ts
      "Completed Date": { id: "Completed Date", type: "date" },
```
with:
```ts
      "Completed Date": { id: "fldM6ApgoMtoQW7RW", type: "date" },
```

- [ ] **Step 2: Add missing Stories fields** (same fields block, keep file's one-line format):
```ts
      "🔵 Team Task Payments": { id: "fldjlCJCwOckeazEu", type: "multipleRecordLinks" },
      "Assignee Commission Amount": { id: "fldGpRvdPOc19UObC", type: "currency" },
      "Commission Percentage (from Assignee)": { id: "fldj02RRtwN360KzT", type: "multipleLookupValues" },
```
(The emoji prefix is `🔵` U+1F535 — byte-exact, same as the existing `"🔵 Time Entries"` key.)

- [ ] **Step 3: Add People.Commission Percentage**
```ts
      "Commission Percentage": { id: "fldC445d4d8lIjLGT", type: "percent" },
```

- [ ] **Step 4: Add TeamTaskPayments.Stories**
```ts
      "Stories": { id: "fldfu34ybjOyJbcfR", type: "multipleRecordLinks" },
```

- [ ] **Step 5: Check AirvuesExpenses block has the fields Task 4 needs** — `"Expense Name"`, `"Internal Team Member Account"`, `"Status"`, `"Type"`. Grep the block; add any missing with these IDs: Expense Name `fldZuEcfy84IIosAO`, Internal Team Member Account `fldFxPqnKgZYEP8M6`, Status `fldILjXt6QmeYixoX`. If `"Type"` is absent from schema.ts, fetch its ID from the Meta API via `npm run verify-schema` tooling or the support MCP before adding — do not guess.

- [ ] **Step 6: Verify against live base**

Run: `npx tsc --noEmit && npm run verify-schema`
Expected: both exit 0 (verify-schema validates every field ID against the Meta API).

- [ ] **Step 7: Commit**
```bash
git add lib/schema.ts
git commit -m "Add verified commission/payment field IDs to schema"
```

---

### Task 2: Per-assignee commission math in the engineering data layer

**Files:**
- Modify: `lib/engineering-types.ts` (Story type, ~line 6-36)
- Modify: `lib/engineering.ts` (people fetch ~line 237-251, PersonRow ~line 288, story mapping ~line 313-367, tallyGroup ~line 470, getStoryById ~line 19-64)

**Interfaces:**
- Produces: `Story.assigneeCommissions: number[]` (parallel to `assigneeIds`, each = round2(cost × that person's rate)); `Story.commission` redefined as the TOTAL across assignees (firm liability), or `cost × 0.15` for unassigned stories. Consumed by Task 3 (display) and by existing group tallies.
- Consumes: `Tables.People.fields["Commission Percentage"]` from Task 1.

- [ ] **Step 1: Extend the Story type** in `lib/engineering-types.ts` — after `commission: number;` add:
```ts
  /** Per-assignee commission (parallel to assigneeIds): round2(cost × that person's rate). */
  assigneeCommissions: number[];
```
and update the comment on `commission` to: `/** Total commission liability: sum of assigneeCommissions, or cost × default rate when unassigned. */`

- [ ] **Step 2: Fetch the rate and add it to PersonRow** in `getEngineeringBoard`:
- Add `pTbl.fields["Commission Percentage"].id` to the People fetch `fields` array (~line 247).
- Add `commissionPct: number;` to the `PersonRow` type and populate it in the `peopleMap` loop:
```ts
    const rawPct = f["Commission Percentage"];
    let commissionPct = COMMISSION_RATE;
    if (typeof rawPct === "number") commissionPct = rawPct > 1 ? rawPct / 100 : rawPct;
```

- [ ] **Step 3: Compute per-assignee commissions in the story mapping** (~line 330). Add a module-level helper near the other helpers:
```ts
const round2 = (n: number) => Math.round(n * 100) / 100;
```
In the `stories` map callback, after `assigneeIds`/`cost` are known (move the `cost` const up above the returned object):
```ts
    const cost = typeof f["Cost"] === "number" ? (f["Cost"] as number) : 0;
    const assigneeCommissions = assigneeIds.map((id) =>
      round2(cost * (peopleMap.get(id)?.commissionPct ?? COMMISSION_RATE)),
    );
    const commission =
      assigneeIds.length > 0
        ? round2(assigneeCommissions.reduce((a, b) => a + b, 0))
        : round2(cost * COMMISSION_RATE);
```
Use these in the returned object (`commission`, `cost`, and add `assigneeCommissions`). Delete the old `commission: invoice * COMMISSION_RATE` line — commission is now **Cost-based** (matches /me and real payouts; Invoice-based board math was the pre-existing inconsistency being fixed).

- [ ] **Step 4: Make group tallies per-developer** in `tallyGroup`. Add above it:
```ts
// A dev's share of a story = their own entry in assigneeCommissions.
// Orphan group keeps the story's total (projected liability at default rate).
function commissionFor(g: EngineerGroup, s: Story): number {
  if (g.isOrphan) return s.commission;
  const idx = s.assigneeIds.indexOf(g.id);
  return idx >= 0 ? s.assigneeCommissions[idx] ?? 0 : 0;
}
```
In `tallyGroup`, replace both `s.commission` usages with `commissionFor(g, s)` (earnedCommission and openCommission). `tallyGlobal` keeps `s.commission` — the total is correct at firm level.

- [ ] **Step 5: Mirror in `getStoryById`** — add `"Commission Percentage"` (by schema id) to its People fetch, build a `pctMap` alongside the name map, and compute `assigneeCommissions`/`commission` with the identical code from Step 3 (when `assigneeIds.length === 0`, skip the fetch: `assigneeCommissions = []`, `commission = round2(cost * COMMISSION_RATE)` — note this function must now also read `Cost`, add it to nothing: it already uses getRecord which returns all fields).

- [ ] **Step 6: Fix any other Story literal builders tsc finds**

Run: `npx tsc --noEmit`
Expected: errors listing every other place a `Story` object is constructed without `assigneeCommissions` (e.g. `lib/scorecard.ts` ratedStories spread is fine since it spreads existing stories). For any builder that has People rates available, compute properly; for pure pass-throughs, preserve the incoming array. Re-run until exit 0.

- [ ] **Step 7: Build and commit**
```bash
npm run build   # must exit 0
git add lib/engineering-types.ts lib/engineering.ts
git commit -m "Compute per-assignee commissions from People rates on Story.Cost"
```
(Include any Step 6 files in the add.)

---

### Task 3: "Shared · N" indicator in the story table

**Files:**
- Modify: `components/engineering/StoryTable.tsx` (name cell, ~line 85)

**Interfaces:**
- Consumes: `Story.assigneeNames` (already present).

- [ ] **Step 1: Add the chip to the Story name cell.** Inside the `<span className="block truncate text-[13px] font-medium text-ink-strong">` element, after `{s.name}`:
```tsx
                  {s.assigneeNames.length > 1 && (
                    <span
                      title={`Shared: ${s.assigneeNames.join(", ")}`}
                      className="ml-1.5 inline-block align-middle rounded border border-violet/30 bg-violet/10 px-1 py-px text-[9px] font-mono uppercase tracking-wider text-violet"
                    >
                      Shared · {s.assigneeNames.length}
                    </span>
                  )}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` exits 0; with the dev server running, open `http://localhost:3002/engineering`, expand a dev card containing a multi-assignee story (find one via the dry-run script's `--scan` in Task 5 if needed) and confirm the chip renders on desktop and mobile layouts (the chip lives in the name cell shared by both).

- [ ] **Step 3: Commit**
```bash
git add components/engineering/StoryTable.tsx
git commit -m "Flag multi-assignee stories with a Shared chip in story tables"
```

---

### Task 4: Completion-payments module (no hook yet)

**Files:**
- Create: `lib/completion-payments.ts`

**Interfaces:**
- Produces: `createCompletionPayments(storyId: string): Promise<CompletionPaymentsResult>` where
  `type CompletionPaymentsResult = { created: { payee: string; amount: number }[]; skipped: { payee: string; reason: string }[] }`.
  Consumed by Task 6 (`lib/mutations/story.ts`).
- Consumes: schema entries from Task 1; `listRecords`, `getRecord`, `createRecords` from `lib/airtable.ts`.

- [ ] **Step 1: Write the module**
```ts
// Creates one 🔵 Team Task Payment per assignee when a story completes.
// Each payee earns their own People.Commission Percentage of the FULL story
// Cost (not a split). Duplicate-guarded: assignees who already have a payment
// linked to the story are skipped — payment creation today is partly manual
// and this must never double-pay. Kill switch: DISABLE_COMPLETION_PAYMENTS=1.
import "server-only";

import { createRecords, getRecord, listRecords } from "./airtable";
import { Tables } from "./schema";
import { COMMISSION_RATE } from "./engineering-types";

export type CompletionPaymentsResult = {
  created: { payee: string; amount: number }[];
  skipped: { payee: string; reason: string }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function asIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.startsWith("rec"));
}

export async function createCompletionPayments(
  storyId: string,
): Promise<CompletionPaymentsResult> {
  const result: CompletionPaymentsResult = { created: [], skipped: [] };
  if (process.env.DISABLE_COMPLETION_PAYMENTS === "1") {
    result.skipped.push({ payee: "*", reason: "disabled via DISABLE_COMPLETION_PAYMENTS" });
    return result;
  }

  const sTbl = Tables.Stories;
  const pTbl = Tables.People;
  const tTbl = Tables.TeamTaskPayments;
  const eTbl = Tables.AirvuesExpenses;

  const story = await getRecord<Record<string, unknown>>(sTbl.id, storyId);
  const f = story.fields;
  const assigneeIds = asIdArray(f["Assignee"]);
  const cost = typeof f["Cost"] === "number" ? (f["Cost"] as number) : 0;
  const storyName = typeof f["Story Name"] === "string" ? (f["Story Name"] as string) : storyId;

  if (assigneeIds.length === 0) {
    result.skipped.push({ payee: "*", reason: "no assignees" });
    return result;
  }
  if (cost <= 0) {
    result.skipped.push({ payee: "*", reason: "story Cost is 0" });
    return result;
  }

  // Existing payments on this story → who is already covered.
  const existingIds = asIdArray(f["🔵 Team Task Payments"]);
  const alreadyPaidPersonIds = new Set<string>();
  const alreadyPaidEmails = new Set<string>();
  for (const pid of existingIds) {
    const pay = await getRecord<Record<string, unknown>>(tTbl.id, pid);
    for (const acct of asIdArray(pay.fields["Internal Team Member Account (from Link to Expenses)"])) {
      alreadyPaidPersonIds.add(acct);
    }
    const payee = pay.fields["Payee"] as { email?: string } | undefined;
    if (payee?.email) alreadyPaidEmails.add(payee.email.toLowerCase());
  }

  // People: names, rates, collaborator emails. Uncached — money math must be fresh.
  const people = await listRecords<Record<string, unknown>>(pTbl.id, {
    fields: [
      pTbl.fields["Full Name"].id,
      pTbl.fields["First Name"].id,
      pTbl.fields["Last Name"].id,
      pTbl.fields["Commission Percentage"].id,
      pTbl.fields["Airtable Account"].id,
    ],
  });
  const personMap = new Map(people.map((p) => [p.id, p.fields]));

  // Open Pending expense batches, newest last in list order — index by person.
  const expenses = await listRecords<Record<string, unknown>>(eTbl.id, {
    fields: [
      eTbl.fields["Expense Name"].id,
      eTbl.fields["Internal Team Member Account"].id,
      eTbl.fields["Status"].id,
    ],
  });
  const openBatchByPerson = new Map<string, string>();
  for (const e of expenses) {
    if (e.fields["Status"] !== "Pending") continue;
    for (const acct of asIdArray(e.fields["Internal Team Member Account"])) {
      openBatchByPerson.set(acct, e.id);
    }
  }

  for (const personId of assigneeIds) {
    const pf = personMap.get(personId);
    const name =
      (pf?.["Full Name"] as string) ||
      [pf?.["First Name"], pf?.["Last Name"]].filter(Boolean).join(" ").trim() ||
      personId;

    const collaborators = pf?.["Airtable Account"] as { email?: string }[] | undefined;
    const email = collaborators?.[0]?.email?.toLowerCase() ?? null;

    if (alreadyPaidPersonIds.has(personId) || (email && alreadyPaidEmails.has(email))) {
      result.skipped.push({ payee: name, reason: "payment already exists for this story" });
      continue;
    }

    const rawPct = pf?.["Commission Percentage"];
    let pct = COMMISSION_RATE;
    if (typeof rawPct === "number") pct = rawPct > 1 ? rawPct / 100 : rawPct;
    if (pct === 0) {
      result.skipped.push({ payee: name, reason: "commission rate is 0" });
      continue;
    }
    const amount = round2(cost * pct);

    // Route to the person's open Pending expense batch; create one if missing.
    let expenseId = openBatchByPerson.get(personId);
    if (!expenseId) {
      const [createdExpense] = await createRecords<Record<string, unknown>>(eTbl.id, [
        {
          fields: {
            "Expense Name": `Project Payments for ${name}`,
            "Internal Team Member Account": [personId],
            Status: "Pending",
            Type: "Contractor Commissions",
          },
        },
      ]);
      expenseId = createdExpense.id;
      openBatchByPerson.set(personId, expenseId);
    }

    await createRecords<Record<string, unknown>>(tTbl.id, [
      {
        fields: {
          Amount: amount,
          Function: "Engineer",
          Status: "Needs Payment",
          ...(email ? { Payee: { email } } : {}),
          Stories: [storyId],
          "Link to Expenses": [expenseId],
          Comments: `Auto-created by Airvues Ops on completion of "${storyName}" (${Math.round(pct * 100)}% of $${cost}).`,
        },
      },
    ]);
    result.created.push({ payee: name, amount });
  }

  return result;
}
```
Adjust to the actual signatures in `lib/airtable.ts` (read it first): if `createRecords` returns records differently or `listRecords` takes different options, mirror the existing call sites in `lib/mutations/`. If the People field key is `"Airtable Account"` under a different name in schema.ts, use the key that owns id `fldeo2BqLzQ5xfiXx`. If `"Type"` isn't a valid AirvuesExpenses schema key (Task 1 Step 5), pass it by name string only if verified, else omit.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` exits 0.

- [ ] **Step 3: Commit**
```bash
git add lib/completion-payments.ts
git commit -m "Add completion-payments module: one payment per assignee at their own rate"
```

---

### Task 5: Read-only dry-run script — validate against live data BEFORE any hook

**Files:**
- Create: `scripts/completion-payments-dryrun.mjs`

**Interfaces:**
- Standalone; mirrors Task 4's decision logic read-only. Run as `node scripts/completion-payments-dryrun.mjs recXXXX` or `--scan`.

- [ ] **Step 1: Write the script** (pattern: `scripts/hygiene-companies.mjs` — reads `.env.local` for `AIRTABLE_TOKEN` + `AIRTABLE_BASE_ID`):
```js
// Dry-run for completion payments. NEVER writes. Usage:
//   node scripts/completion-payments-dryrun.mjs recStoryId   → plan for one story
//   node scripts/completion-payments-dryrun.mjs --scan       → list multi-assignee stories
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID || "app4vhhWMbRFOloOU";
const H = { Authorization: `Bearer ${TOKEN}` };
const api = (path) => fetch(`https://api.airtable.com/v0/${BASE}/${path}`, { headers: H }).then((r) => r.json());
const listAll = async (table, params = "") => {
  let records = [], offset;
  do {
    const page = await api(`${table}?${params}${offset ? `&offset=${offset}` : ""}`);
    records = records.concat(page.records ?? []);
    offset = page.offset;
  } while (offset);
  return records;
};
const round2 = (n) => Math.round(n * 100) / 100;
const RATE_DEFAULT = 0.15;

const STORIES = "tblgd7iKw2KdPBkn2";
const PEOPLE = "tbl9wvZY9M7Y7hcf1";
const PAYMENTS = "tblvzdxVq7drJtobt";
const EXPENSES = "tblhQ9jkgVAuG97gg";

const arg = process.argv[2];
if (!arg) { console.error("usage: dryrun <recStoryId> | --scan"); process.exit(1); }

if (arg === "--scan") {
  const stories = await listAll(STORIES, "fields%5B%5D=Story%20Name&fields%5B%5D=Assignee&fields%5B%5D=Story%20Status&fields%5B%5D=Cost");
  for (const s of stories) {
    const a = s.fields.Assignee ?? [];
    if (a.length > 1) console.log(`${s.id}  [${s.fields["Story Status"]}]  $${s.fields.Cost ?? 0}  ${a.length} assignees  ${s.fields["Story Name"]}`);
  }
  process.exit(0);
}

const story = await api(`${STORIES}/${arg}`);
const f = story.fields;
console.log(`Story: ${f["Story Name"]}  status=${f["Story Status"]}  cost=$${f.Cost ?? 0}`);
const assignees = f.Assignee ?? [];
const existing = f["🔵 Team Task Payments"] ?? [];
const coveredPeople = new Set(); const coveredEmails = new Set();
for (const id of existing) {
  const p = await api(`${PAYMENTS}/${id}`);
  for (const a of p.fields["Internal Team Member Account (from Link to Expenses)"] ?? []) coveredPeople.add(a);
  if (p.fields.Payee?.email) coveredEmails.add(p.fields.Payee.email.toLowerCase());
  console.log(`  existing payment ${id}: $${p.fields.Amount} → ${p.fields.Payee?.name ?? "?"} [${p.fields.Status}]`);
}
const expenses = await listAll(EXPENSES, "fields%5B%5D=Expense%20Name&fields%5B%5D=Internal%20Team%20Member%20Account&fields%5B%5D=Status");
for (const pid of assignees) {
  const person = await api(`${PEOPLE}/${pid}`);
  const pf = person.fields;
  const name = pf["Full Name"] ?? pid;
  const raw = pf["Commission Percentage"];
  const pct = typeof raw === "number" ? (raw > 1 ? raw / 100 : raw) : RATE_DEFAULT;
  const email = (pf["Airtable Account"] ?? pf["User"] ?? [])[0]?.email?.toLowerCase() ?? null;
  const dup = coveredPeople.has(pid) || (email && coveredEmails.has(email));
  const batch = expenses.find((e) => e.fields.Status === "Pending" && (e.fields["Internal Team Member Account"] ?? []).includes(pid));
  console.log(
    `  ${dup ? "SKIP (already paid)" : "WOULD CREATE"}: ${name}  ${Math.round(pct * 100)}% × $${f.Cost ?? 0} = $${round2((f.Cost ?? 0) * pct)}` +
    `  payee=${email ?? "(no collaborator!)"}  batch=${batch ? batch.fields["Expense Name"] : "(would create new)"}`,
  );
}
```

- [ ] **Step 2: Scan for real multi-assignee stories**

Run: `node scripts/completion-payments-dryrun.mjs --scan`
Expected: a list (Jose mentioned discovery stories with 2 people). Pick one non-Completed story id.

- [ ] **Step 3: Dry-run it and review the numbers by hand**

Run: `node scripts/completion-payments-dryrun.mjs <recId>`
Expected: one `WOULD CREATE` line per assignee, each amount = their own % of full cost, correct batch resolution, and `SKIP` lines for anyone already covered. Also dry-run an already-paid single-assignee Completed story (e.g. `recC4rioSBr0DONzP`, Job 732's story) and confirm it reports SKIP — that proves the duplicate guard.

- [ ] **Step 4: Show the dry-run output to the user for sign-off before Task 6.** This is a hard checkpoint — real payment rows are created from Task 6 onward.

- [ ] **Step 5: Commit**
```bash
git add scripts/completion-payments-dryrun.mjs
git commit -m "Add read-only dry-run script for completion payments"
```

---

### Task 6: Hook into story completion + surface feedback

**Files:**
- Modify: `lib/mutations/story.ts` (`MutationResult` ~line 29, `updateStory` ~line 79-102, `bulkUpdateStories` ~line 104-123)
- Modify: `components/engineering/StorySheet.tsx` (`save()` ~line 136-148 + a notice line near the saved-flash UI)
- Modify: `CLAUDE.md` (document the behavior + kill switch)

**Interfaces:**
- Consumes: `createCompletionPayments` from Task 4.
- Produces: `MutationResult` success arm becomes `{ ok: true; paymentsCreated?: number }`.

- [ ] **Step 1: Extend MutationResult and hook updateStory**
```ts
export type MutationResult = { ok: true; paymentsCreated?: number } | { error: string };
```
In `updateStory`, inside the existing `if (patch.status === "Completed")` block (keep the logEventInternal call), before the return:
```ts
    let paymentsCreated: number | undefined;
    if (patch.status === "Completed") {
      try {
        const payRes = await createCompletionPayments(storyId);
        paymentsCreated = payRes.created.length;
        invalidateStoryCaches();
      } catch (e) {
        // Never fail the status change over payment automation; surface via log.
        await logEventInternal({
          projectId: null,
          eventType: "Payment automation failed",
          detail: `Story ${storyId}: ${(e as Error).message}`,
        });
      }
      await logEventInternal({
        projectId: null,
        eventType: "Story completed",
        detail: `Story ${storyId} marked Completed`,
      });
    }
    return { ok: true, paymentsCreated };
```
Import at top: `import { createCompletionPayments } from "../completion-payments";`

- [ ] **Step 2: Hook bulkUpdateStories** — after the patch succeeds, when `patch.status === "Completed"`:
```ts
    if (patch.status === "Completed") {
      for (const id of storyIds) {
        try { await createCompletionPayments(id); } catch { /* logged per-story path only in single flow */ }
      }
      invalidateStoryCaches();
    }
```

- [ ] **Step 3: Show feedback in StorySheet.** Add state next to the existing error/savedFlash state: `const [notice, setNotice] = useState<string | null>(null);` — reset it in the story-switch effect (`setNotice(null)` beside `setError(null)`). In `save()`:
```ts
      const result = await updateStory(story!.id, payload);
      if (!("ok" in result)) {
        setError(result.error);
      } else {
        if (result.paymentsCreated) {
          setNotice(
            `${result.paymentsCreated} commission payment${result.paymentsCreated === 1 ? "" : "s"} queued (Needs Payment)`,
          );
        }
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      }
```
Render the notice directly under wherever `error` renders, same styling but emerald:
```tsx
      {notice && (
        <div className="px-5 py-2 text-[12px] text-emerald bg-emerald/10 border-b border-emerald/20">
          {notice}
        </div>
      )}
```
(Match the exact placement/classes of the existing error banner — read the file at execution time.)

- [ ] **Step 4: Document in CLAUDE.md** — add to the schema-gotchas/auth area a short block:
```md
- **Completing a story creates money rows.** `updateStory`/`bulkUpdateStories` with status `Completed` auto-create one 🔵 Team Task Payment per assignee (their own People.Commission Percentage × Story.Cost, Status "Needs Payment", routed to their open Pending expense batch). Duplicate-guarded per story+payee. Kill switch: `DISABLE_COMPLETION_PAYMENTS=1`. Logic: `lib/completion-payments.ts`; dry-run: `scripts/completion-payments-dryrun.mjs`.
```

- [ ] **Step 5: Full verification**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

Then live test with the user's blessing on ONE cheap story: complete it via the UI, then re-run the dry-run script on that story — expected: every assignee now shows `SKIP (already paid)`, and the Airtable base shows exactly one new payment per assignee with correct amounts. If anything is wrong: set `DISABLE_COMPLETION_PAYMENTS=1` in Vercel + `.env.local` immediately and delete the bad rows in Airtable by hand.

- [ ] **Step 6: Commit**
```bash
git add lib/mutations/story.ts components/engineering/StorySheet.tsx CLAUDE.md
git commit -m "Create per-assignee commission payments when a story completes"
```

---

## Out of scope (explicitly)

- Writing `Assignee Commission Amount` on Stories — single currency field can't represent two rates; an unknown existing flow owns it.
- A management UI for editing `People.Commission Percentage` (the /team page work Jose raised — separate feature).
- Retroactive payment creation for already-Completed shared stories — run the dry-run script per story and decide manually.
