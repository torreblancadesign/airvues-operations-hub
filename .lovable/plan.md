## Goal

Make the Pipeline page KPIs reflect what each number actually means: what we've **sold** YTD, what's still being **sold** (open), and what's already sold and being **delivered** (active). Today, "YTD Won" only counts fully Paid quotes and "Pipeline $" mixes not-yet-sold with sold-but-not-finished — making both numbers misleading.

## Status → bucket mapping (canonical)

| Bucket | Statuses |
|---|---|
| **Open** (still selling) | `Draft`, `Sent. Awaiting Approval.`, `Auditing 🚩` |
| **Active** (sold, delivering) | `Approved and Signed`, `Awaiting Payment`, `Project In Progress` |
| **Won/Booked** (sold, any state) | Active ∪ `Paid` |
| **Collected** (cash in) | `Paid` |
| **Lost** | `Cancelled`, `Rejected` |

"YTD" = `preparedDate >= Jan 1 of current year`.

## KPI row redesign

Replace the current 5-card row 1 with:

1. **Booked YTD** (emerald) — sum of `totalCost` where status ∈ Won and `preparedDate` is YTD. Sub: `N quotes · X% of $500k goal`.
2. **Collected YTD** (emerald, softer) — sum of `totalCost` where status = `Paid` and YTD. Sub: `N paid · $Y still owed` (uses `amountOwed` on the same set).
3. **Open pipeline** (amber) — sum of `totalCost` where status ∈ Open (all-time, not YTD). Sub: `N quotes · $X stalled >14d` (clickable → stalled filter).
4. **Active work** (sky) — sum of `totalCost` where status ∈ Active. Sub: `N projects · $X unpaid` (sum of `amountOwed` on this set).
5. **Quote → Paid** (neutral) — keep current conversion %. Sub: `N paid / N sent`.

Row 2 (stage breakdown cards: Draft / Sent · awaiting / Signed (active) / Paid / Lost) stays as-is — it's the granular click-to-filter row and still useful.

Drop the standalone **Avg velocity** card from row 1; move it into the QuoteSheet drawer or the stage-breakdown header as a small inline stat (it's interesting but not a top-5 KPI).

## Implementation details

All changes are inside `components/pipeline/PipelineDashboard.tsx` — no data-layer changes (`PipelineQuote` already has `status`, `totalCost`, `amountOwed`, `preparedDate`).

- Rewrite the `kpis` `useMemo` to compute: `bookedYtd`, `bookedYtdCount`, `collectedYtd`, `collectedYtdOwed`, `collectedYtdCount`, `openDollars`, `openCount`, `stalledDollars`, `stalledCount`, `activeDollars`, `activeCount`, `activeUnpaid`, `conversion`, `paidCount`, `sentCount`.
- Use the bucket sets above (extract `OPEN_STATUSES` / `ACTIVE_STATUSES` constants near the top of the file, alongside the existing `STAGE_STATUSES`).
- Conversion stays defined as `paid / sent` where `sent` = anything that ever left Draft (current definition is fine).
- Row 2 (stage cards) and the stage breakdown bar chart below it are unchanged.

## Out of scope

- QuoteTable, QuoteSheet, FilterBar — no changes.
- Goal target ($500k) stays hardcoded; making it configurable is a separate task.
- Avg velocity relocation is optional polish; leaving it off row 1 is the main point.

## Verification

- `/pipeline` row 1 shows: **Booked YTD · Collected YTD · Open pipeline · Active work · Quote → Paid**.
- Booked YTD ≥ Collected YTD (Booked includes Paid + Active YTD).
- Open pipeline no longer double-counts the Active bucket.
- Stalled card removed from row 1 but stalled $/count surfaces as the sub on Open pipeline and the "Stalled only" checkbox in the filter bar still works.
- Stage breakdown row 2 + bar chart unchanged.
- `npx tsc --noEmit` + `npm run build` clean.
