## Goal

On the Firm Pulse hero revenue tile, the YTD view currently shows a cumulative emerald line/area. Add a layer of **per-month revenue bars** sitting behind that line so we can see how each individual month performed, with hover tooltips showing the exact dollar figure for that month. MTD stays as-is (it's already daily granularity, and bars there would be noisy).

## What changes

### 1. `lib/firm-pulse.ts` — expose per-month values

Today `buildRevenueSeries()` returns a `TrendPoint[]` where `value` is cumulative. Extend `TrendPoint` (or add a sibling field) so each YTD point also carries that month's standalone revenue:

```ts
export type TrendPoint = { label: string; value: number; monthly?: number };
```

In the YTD loop, set `monthly: monthTotals[m]` alongside the existing cumulative `value`. MTD points leave `monthly` undefined.

### 2. `components/home/RevenueTrend.tsx` — render bars (YTD only)

When `windowName === "ytd"` and any point has `monthly` set:
- Compute a separate y-scale for the bars based on `max(monthly)` so they aren't squashed under the cumulative ceiling. Bars max out at ~55% of inner chart height so the cumulative line still reads as the dominant element.
- Render one slim bar per month, centered on each point's `x`, using a muted emerald (`rgba(34,211,168,0.18)` fill, `0.35` on hover). Bars sit behind the area/line layers in SVG draw order.
- Hover behavior: the existing `handleMove` already snaps to the nearest point. Update the hover chip to show both lines when monthly is present:
  - `Jun · $42,000 this month`
  - `$187,500 YTD`
- Keep the existing endpoint dot, pace baseline, target tick label, and axis labels unchanged.

### 3. No changes needed elsewhere

`FirmPulse.tsx` already passes `r.series` and `windowName` into `RevenueTrend`. MTD continues to render the line-only view it does today.

## Visual outcome

YTD chart reads as: faint emerald monthly bars (one per Jan–current month) → emerald cumulative line + area sweeping up across them → dashed pace baseline → endpoint dot. Hovering any month surfaces both "this month" and "YTD through this month" figures in the chip.

## Out of scope

- No changes to MTD view.
- No changes to the headline number, progress bar, verdict, or targets.
- No new data fetches — we already aggregate `monthTotals` in `buildRevenueSeries`; we just stop discarding it.
