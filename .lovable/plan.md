# Clarify "All Time" Section on /money

The new "This Month" section sits above the existing KPI strip, but there's no label telling the user the KPIs below it are lifetime/all-time numbers. Add a small section header.

## Change

In `components/money/MoneyDashboard.tsx`, insert a heading row directly above the all-time KPI grid:

```tsx
<div className="mb-3 flex items-baseline justify-between gap-4">
  <h2 className="text-[13px] font-semibold text-ink-strong uppercase tracking-wider">All Time</h2>
  <span className="font-mono text-[11px] text-ink-faint tabnum">Since inception</span>
</div>
```

This matches the existing `SectionTitle` visual style used by "This Month" (same font size, weight, tracking, color tokens). No new components or data changes.

## Files touched

- `components/money/MoneyDashboard.tsx` — one insertion, ~4 lines