## Goal

Redo the top "Path to Founder Replacement Income" section on `/founder` so it's the visual centerpiece: clean, sleek, hero-grade. Surface the three numbers that matter most + one new predictive metric.

## New top-section content (4 KPIs)

1. **% to goal** — large hero number + animated progress bar (already exists, refined)
2. **Current yearly earnings (net)** — annualized founder take-home at today's run-rate (we already compute `current.founderNetAnnual`)
3. **Monthly revenue needed** — kept, but demoted to a supporting stat
4. **NEW — Predicted months to goal** — based on recent monthly revenue growth trend

Everything below the hero (current-pace card, at-goal card, gap analysis, scenarios, assumptions) stays as-is.

## "Predicted months to goal" math

Fetch the last 6 closed months of paid-invoice revenue (same source as `buildRevenueSeries` in `lib/firm-pulse.ts`, but server-side helper scoped to founder page).

```text
recent_months   = last up-to-6 fully-closed months of paid revenue
avg_growth_$    = mean of (month[i] - month[i-1]) over that window
current_rev     = latest closed month (or live MTD if it already exceeds)
gap_to_goal     = max(0, monthlyGoal - current_rev)

if current_rev >= monthlyGoal      → "At goal"
else if avg_growth_$ <= 0          → "Trend flat/negative"
else months_to_goal ≈ ceil(gap_to_goal / avg_growth_$)
```

Display as `~N months` with a one-line subtext: `"based on +$X,XXX/mo avg growth (last 6 mo)"`. Edge cases ("at goal", "trend flat") render a short label instead of a number, never NaN/Infinity.

## Visual direction

Hero section becomes a layered card:

- Eyebrow + title line unchanged
- **Primary row:** giant % to goal (left, ~64px emerald) and animated gradient progress bar with shimmer
- **Secondary KPI strip:** 3 sleek mini-tiles in a row — `Current yearly earnings` / `Predicted months to goal` / `Monthly revenue needed` — each with eyebrow, tabnum value, one-line context
- Existing `Current month revenue` input + `Edit retirement #` action move into a compact, less prominent footer row inside the same card (still editable, just visually quieter)
- Subtle inner glow + gradient border accent on the hero card to make it feel like the dashboard's centerpiece without breaking the existing dark/emerald system

No new design tokens needed — uses existing `bg-surface`, `border-rule`, `emerald`, `ink-*`.

## Files to touch

- `lib/founder.ts` — add `getFounderRevenueTrend()` returning `{ monthlyHistory: number[], avgMonthlyGrowth: number, latestClosedMonth: number }`. Reuses the same Airtable paid-invoice query shape as `buildRevenueSeries`.
- `app/(app)/founder/page.tsx` — call the new helper, pass trend data into `FounderDashboard`.
- `components/founder/FounderDashboard.tsx` — accept new props, compute `monthsToGoal`, rebuild the top hero section layout. Everything below the hero is untouched.
- `lib/founder-math.ts` — add a tiny pure helper `predictMonthsToGoal({ currentMonthlyRevenue, monthlyGoal, avgMonthlyGrowth })` returning `{ kind: "at-goal" | "flat" | "months", value?: number }`.

## Out of scope

- No changes to assumptions, scenario table, gap analysis, or projection cards.
- No Airtable schema changes.
- No new routes or nav entries.
