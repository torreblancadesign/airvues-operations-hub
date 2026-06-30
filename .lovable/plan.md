## Show RevenueTrend chart on mobile

The Firm Pulse revenue card hides the trend chart on screens below the `lg` breakpoint (`hidden lg:block` at `components/home/FirmPulse.tsx:280`). On mobile the card collapses to just the YTD/MTD total and pace bar — the bars/area chart never renders.

### Change

In `components/home/FirmPulse.tsx`, drop the `hidden lg:` gate so the chart renders at every breakpoint:

```
- <div className="hidden lg:block mt-6">
+ <div className="mt-6">
    <RevenueTrend series={r.series} target={r.target} windowName={win} />
  </div>
```

### Mobile fit check

`RevenueTrend` already uses a responsive `viewBox` SVG (`w-full`, fixed aspect ratio) and reads its container width, so it scales down cleanly inside the card's existing `p-6 sm:p-7` padding. The hover tooltip is positioned with `left/top` percentages and clamps inside the SVG, so it works on touch (tap-to-show) without extra changes.

No other files need to change.