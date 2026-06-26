## Scope

Three additions to the Team Scaling Simulator. Touches `lib/scaling-math.ts` and `components/founder/TeamScalingSimulator.tsx` only.

---

## 1. Split Client Solutions commission: projects vs retainers

Today there's one `clientSolutionsRate` applied to project revenue. Split it:

- `clientSolutionsProjectRate` (default 0.15) — applied to project revenue.
- `clientSolutionsRetainerRate` (default e.g. 0.05) — applied to retainer revenue (only retainers where a per-retainer "pay sales commission" flag is on, matching the existing engineer-commission-per-retainer pattern).

UI: replace the single Client Solutions rate input with two side-by-side inputs ("Projects %" / "Retainers %"). Add a per-retainer "Pay sales commission" toggle next to the existing "Pay engineer commission" toggle.

Migration: legacy `clientSolutionsRate` → `clientSolutionsProjectRate`; retainer rate defaults to 0.05; per-retainer sales-commission flag defaults to true (preserves "applied to all new sales" intent for projects, conservative default for retainers — user can toggle off).

Math: `computeScenario` adds retainer sales commission into variable cost; margin recalculates accordingly. `FounderDashboard` aggregate math (`lib/founder-math.ts`) is **not** touched — only the simulator uses the split.

---

## 2. Manual hour overrides for lower-priority tiers

Capacity fill is strictly priority-order today. Add an optional override per tier:

- New per-tier field `manualProjectHours?: number` (and `manualRetainerHours?: number`).
- When set (>0), that tier is reserved that many hours of work **before** the priority-based fill runs on remaining demand. This lets the user say "always give 40 project hrs/mo to the senior tier even though juniors are higher priority".
- Reserved hours are capped at the tier's available capacity and at remaining demand.
- After reservations, the existing priority fill distributes the rest.

UI: small "Reserve hrs/mo" inputs on each tier row (collapsed by default behind a "+ reserve" toggle to keep the row compact). Tooltip explains it forces hours to that tier regardless of priority. Utilization bars show reserved hours in a slightly different shade so it's obvious.

Hiring signal logic accounts for reserved hours when computing shortfall.

---

## 3. Scaling charts (revenue → margin & capacity)

New "Scaling outlook" section below the current Live Readout. Pure SVG (match `RevenueTrend.tsx` / `Sparkline.tsx` patterns — no chart lib).

**Inputs (small controls at top of section):**
- Revenue range: project-revenue sweep from current → 3× current (slider for max, default 3×).
- Retainer growth mode: "hold current retainers" vs "scale retainer revenue proportionally with projects" (toggle).
- Step count: 12 steps across the range.

**Three stacked charts, shared x-axis (monthly project revenue):**

1. **Margin curve** — line chart of margin% at each revenue step, with a horizontal target-margin reference line. Color the line by verdict (healthy/tight/below) per segment.
2. **Capacity & hiring** — stacked area showing total demand hours (project + retainer) vs total current capacity hours. Where demand crosses capacity, mark the x-position with a vertical "Hire here" marker and a chip showing recommended additional heads (derived from shortfall / avg tier `hoursPerMonth`, split by projects/retainers eligibility).
3. **Founder take-home** — line chart of monthly founder net at each step (uses the simulator's existing ownership + payroll-tax math), with the monthly-goal as a reference line.

Hover anywhere shows a synced tooltip across all three with: project revenue, retainer revenue, margin%, total demand vs capacity, founder net, and any hiring recommendation at that point.

Implementation: a `computeScalingCurve(inputs, { steps, maxMultiplier, retainerMode })` helper in `lib/scaling-math.ts` returns an array of `{ projectRevenue, retainerRevenue, margin, demandHours, capacityHours, shortfallByGroup, founderNet, hireRecommendation }`. The chart components live in `TeamScalingSimulator.tsx` (or a sibling file `ScalingCurves.tsx` if it gets long — same folder, still simulator-scoped).

---

## Files touched

**Modified**
- `lib/scaling-math.ts` — split sales-commission fields + migration; `Retainer` gains `paySalesCommission`; `EngineerTier` gains `manualProjectHours` / `manualRetainerHours`; `computeScenario` reserves manual hours before priority fill and adds retainer sales commission to variable cost; new `computeScalingCurve` helper.
- `components/founder/TeamScalingSimulator.tsx` — split rate inputs; per-retainer sales-commission toggle; per-tier reserve-hours UI; new "Scaling outlook" section with three SVG charts and synced hover.

**Optional new**
- `components/founder/ScalingCurves.tsx` — only if the chart code exceeds ~250 LOC; otherwise inline.

**Not touched**
- `lib/founder-math.ts`, `FounderDashboard.tsx` aggregate math, Airtable schema, any other page.

## Out of scope

- Persisting scaling-chart settings per scenario (charts re-derive from current inputs each render).
- Per-retainer assignment to a specific tier (still priority + reservations within eligible tiers).
- Chart library adoption (staying pure SVG to match existing visuals).
