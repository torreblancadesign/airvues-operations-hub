# Add Monthly Focus Section to /money

Add a new section at the top of the Money page focused on the current calendar month, with goal progress bars for monthly revenue and MRR.

## What's new

**Placement:** Above the all-time KPI strip on `/money`. The existing 5-card KPI row, Outstanding/MRR row, AR aging, and invoice table stay exactly as they are — this is additive.

**Section contents:**
1. **Section header** — "This Month" with a small "May 2026 · 61% elapsed" eyebrow on the right (auto-calculated from days-of-month).
2. **Two stat cards** (compact, same `StatCard` component as the KPI strip):
   - Revenue MTD (emerald) — sum of paid invoices dated in current month, sub-label shows invoice count
   - MRR (sky) — same calculation as the existing MRR card but surfaced here too for at-a-glance
3. **Two `GoalBar` progress bars** side-by-side:
   - **Monthly Revenue Goal** — $50,000 target, tone adapts to month-pacing (emerald if on/ahead, amber if behind, red if well behind, matching the `CompanyGoals` pattern)
   - **MRR Goal** — default target $10,000 (constant at top of component, easy to edit). Tone purely based on % to target.

## Technical details

**New constants** (top of new component, easy to tweak later):
```ts
const MONTHLY_REVENUE_GOAL = 50_000;
const MRR_GOAL = 10_000; // placeholder — user can adjust
```

**New computation in `MoneyDashboard.tsx`** — extend the existing `kpis` useMemo to also produce `mtdRevenue` and `mtdPaidCount` by filtering paid invoices where `r.date` falls in current month (uses local timezone, same approach as the existing `arAgingBuckets`). MRR is already calculated.

**New component:** `components/money/MonthlyFocus.tsx` — pure presentational, takes `{ mtdRevenue, mtdPaidCount, mrr }`, renders the section header + 2 StatCards + 2 GoalBars. Reuses existing `GoalBar`, `StatCard`, and `SectionTitle` primitives — no new design tokens needed.

**Wiring:** `MoneyDashboard.tsx` renders `<MonthlyFocus ... />` immediately after `<FilterBar />` and before the all-time KPI grid.

**Goal-pacing logic** (mirrors `CompanyGoals`):
```ts
const now = new Date();
const dayOfMonth = now.getDate();
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const monthProgress = dayOfMonth / daysInMonth;
const revenueProgress = mtdRevenue / MONTHLY_REVENUE_GOAL;
const tone = revenueProgress >= monthProgress ? "emerald"
           : revenueProgress >= monthProgress * 0.7 ? "amber"
           : "red";
```

## Files touched

- `components/money/MonthlyFocus.tsx` — **new**, ~80 lines
- `components/money/MoneyDashboard.tsx` — extend `kpis` useMemo with MTD fields, mount the new section above the KPI strip
- No changes to data layer, schema, mutations, or auth

## Out of scope

- Storing monthly goals in Airtable (constants for now; ask later if you want a `Settings` table)
- Historical month-over-month comparison (separate feature)
- Customizing the MRR goal — using $10k placeholder; tell me the right number and I'll swap it