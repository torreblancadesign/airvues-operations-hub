# Team Scaling & Margin Simulator — Founder page

Adds a new strategic planning section to the Founder dashboard so the founders can model how team composition (salaried vs. commission-only) affects margins and founder take-home. Purely additive — existing hero / projection / gap-analysis / scenario sections stay untouched.

## What gets added

A new **"Team Scaling & Margin Simulator"** section below the existing scenario table, with three blocks:

1. **Revenue & Team Assumptions** (editable inputs)
2. **Live Margin Readout** (computed P&L + verdict chip)
3. **Scenario Comparison** (up to 4 saved scenarios side-by-side)

## Inputs

**Revenue mix**
- Monthly project revenue
- Monthly retainer revenue
- (Total revenue auto-computed)

**Team composition** (count + role-specific fields)
- Salaried engineers — count, avg monthly salary, project commission % (default **15%**)
- Commission-only engineers — count, project commission % (default **30%**)
- Head of Client Solutions / sales — count, avg monthly salary, commission % on project revenue (default **15%** — assumes they always run the blueprint)
- Other fixed roles — count, avg monthly salary (catch-all bucket)

**Cost & strategy**
- Software / overhead monthly cost
- Target company margin %
- Founder ownership %
- Desired monthly founder net income
- Employer payroll tax % (reused from existing assumptions)

Commission base = **project revenue only** (retainers excluded), with a per-role toggle to also include retainers if needed.

## Live readout

KPI grid + verdict chip:
- Total revenue
- Fixed salaries + overhead
- Total commissions (split by role)
- Total team cost
- Gross profit
- Net margin % vs target (emerald ≥ target, amber within 5pp, red below)
- Founder distributable profit
- Founder net monthly (after ownership % and payroll tax)
- Gap vs desired monthly net
- Headroom: "$X/mo revenue available before next salaried hire breaks target margin"
- Verdict: **Healthy / Tight / Below target**

## Scenario comparison

- Up to 4 named scenarios; one is the active editable one, others are snapshots
- Default seeds: "Current team", "+1 salaried engineer", "+1 commission-only engineer", "Higher revenue + expanded team"
- "Save as scenario" captures current inputs; "Load" puts a scenario back into edit
- Side-by-side table: revenue, team cost, gross profit, margin %, founder net monthly, founder net annual, gap to goal
- Persisted in `localStorage` under `founder:scaling-scenarios:v1` — per-founder sandbox, no Airtable writes

## Files

**New**
- `lib/scaling-math.ts` — pure functions and types (`ScalingInputs`, `ScalingOutput`, `computeScenario`). No I/O. Mirrors style of `lib/founder-math.ts`.
- `components/founder/TeamScalingSimulator.tsx` — client component. Owns inputs, computes via `computeScenario`, renders readout + scenarios, persists via localStorage.

**Modified**
- `components/founder/FounderDashboard.tsx` — render `<TeamScalingSimulator />` as a new section after the existing scenario table, seeded with `monthlyRevenue`, `ownership`, `payrollTaxRate`, and `desiredMonthlyNet` derived from existing assumptions.
- `lib/use-local-storage.ts` — add `useLocalStorageJSON<T>` helper if not already present.

**Not changed**
- `app/(app)/founder/page.tsx` — no new server data needed; simulator is fully client-side.
- `lib/founder-math.ts`, `lib/founder.ts`, `lib/mutations/founder.ts` — untouched.

## Technical details

- Pure client-side math; existing `requireRole("admin")` gate on the page still protects access.
- Role commission defaults as constants in `lib/scaling-math.ts`:
  - `SALARIED_ENGINEER_COMMISSION = 0.15`
  - `COMMISSION_ONLY_ENGINEER = 0.30`
  - `CLIENT_SOLUTIONS_COMMISSION = 0.15` (assumes always running blueprint)
- Margin thresholds: Healthy ≥ target, Tight ≥ target − 5pp, else Below target.
- UI follows existing `Section` / `StatCard` / `fmtUsd` / `fmtPct1` / tabnum conventions for visual consistency.

## Out of scope

- Persisting scenarios to Airtable / sharing between founders
- Multi-month projections (single-month steady-state model)
- Per-deal profitability (uses aggregate project revenue)
- Auto-pulling current team from People (manual entry for now)
