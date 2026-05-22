## Goal

Fill the empty space below the big `$97,228` number in the Firm Pulse revenue hero tile with a sleek cumulative-revenue trend chart. Hidden on mobile, smooth swap when toggling YTD ↔ MTD.

## What it shows

- **Cumulative paid invoice revenue** plotted over the active window, ending at the current "collected" total (matches the headline number).
- A faint dashed **pace line** representing linear progress toward target (annual for YTD, monthly for MTD) — so the visual instantly tells you "we're tracking under the pace line."
- Emerald gradient area fill under the actual line; thin pace guideline in `ink-muted`.
- Small axis hints: first-period label on the left, current-period on the right, `target` tick on the y-axis. No heavy grid.

YTD window → x-axis = Jan…current month, 12 buckets, cumulative monthly.
MTD window → x-axis = day 1…last day of month, daily cumulative.

## Where it lives

Inside the existing hero `<Link href="/money">` block in `components/home/FirmPulse.tsx`, below the progress bar + verdict row, wrapped in `hidden lg:block` so mobile stays untouched.

## Implementation

### 1. `lib/firm-pulse.ts` — extend `FirmPulse` type + `getFirmPulse()`

- Add one extra cached read of paid Invoices for the year (reuse the existing `kpi:revenue` cache tag where possible; otherwise a new `firm-pulse:revenue-series` tag with the `Date` + `Invoice Amount` fields).
- Build two series in-memory:
  - `ytdSeries`: 12 points `{ label: "Jan" | …, value: cumulativeUSD }`, only including months up to the current month (future months omitted, not zeroed).
  - `mtdSeries`: `daysInMonth` points `{ label: "1" | "15" | …, value: cumulativeUSD }`, only including days up to today.
- Attach to the existing `revenue.ytd` and `revenue.mtd` objects as a new `series: { label: string; value: number }[]` field, plus reuse `target` for the pace baseline.

### 2. New `components/home/RevenueTrend.tsx` (client component)

- Pure SVG, no chart library. Inputs: `series`, `target`, `windowName: "ytd" | "mtd"`.
- Computes scaled path (`<path d="...">`) for the cumulative line + matching area (`fill="url(#emeraldFade)"`).
- Dashed pace line from `(0, 0)` to `(maxX, target)` clipped to chart area, so the actual line crossing above/below pace is visible at a glance.
- Hover: thin vertical guide + a small label chip showing the period label and `$XX,XXX` cumulative. Pointer events tracked via `onMouseMove` on the SVG. No tooltip lib.
- Fixed aspect ratio (`viewBox="0 0 600 140"`, `preserveAspectRatio="none"` for the path, real text overlays). Height ~140px keeps the tile balanced.
- Animation: on mount and on window change, animate `stroke-dashoffset` from full length → 0 over ~600ms for the line, fade-in the area. Re-keyed by `windowName` so toggling re-plays the draw.

### 3. `components/home/FirmPulse.tsx` — render

```text
{progress bar}
{verdict + elapsed row}
<div className="hidden lg:block mt-6">
  <RevenueTrend series={r.series} target={r.target} windowName={win} />
</div>
```

No changes to the satellite tiles, MTD toggle, or any other section.

## Out of scope

- Year-over-year overlay.
- MRR / booked / pipeline trends (could be a later pass).
- Mobile chart variant.
- Drill-down on click (the whole tile already links to `/money`).
