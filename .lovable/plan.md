## Replace earnings ledger with monthly bar chart + drill-down side panel

Swap the long table for a clean monthly bar chart. Clicking a bar opens a right-side panel listing the payments for that month.

### UI changes (`components/me/PersonScorecard.tsx`)

Replace the existing "Earnings Detail" table section with:

1. **Monthly bar chart**
   - Shows the trailing 12 months (rolling), oldest → newest left-to-right, with the current month last.
   - Stacked bar per month: emerald = Paid, amber = Needs Payment (so outstanding is visible without cluttering the totals).
   - Y-axis is implicit (bars scale to the max month in the window); each bar shows the total dollar amount above it on hover, with a small month label (e.g. "Jan", "Feb"… plus "'26" tick on January).
   - Built with plain divs/CSS (no chart lib) — matches the style already used in `ArAgingChart` / "Owed by person" lists.
   - A small toggle above the chart switches the window: **12 months / YTD / All-time (by year)**. (All-time switches the X-axis to yearly bars so longer histories stay readable.)
   - KPI strip above the chart: window total, paid total, outstanding total.

2. **Click-to-drill side panel**
   - Clicking a bar opens a right-side sheet (reuse the existing drawer pattern from `StorySheet` for consistency — fixed right panel, backdrop, ESC/close button).
   - Header: month label + total amount + payment count.
   - Body: the same compact payment rows we already designed (date · function · client/project · status pill · amount), sorted newest-first, with Airtable link.
   - Closing the panel returns focus to the chart.

3. **Empty state**: same dashed-card placeholder when `payments.length === 0`.

### Data layer

No data changes. `scorecard.payments` already contains the full list with date/status/amount/etc. Monthly grouping happens client-side in the component via a `useMemo` keyed off `payments`.

### Out of scope
- No new filters, no CSV export.
- No changes to the Earnings stat cards above (they keep showing lifetime/YTD/MTD/outstanding).
- No backend or permissions changes.
