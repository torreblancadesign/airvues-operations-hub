## Add "Quote → Sold" conversion KPI

Today both surfaces only show **Quote → Paid** (paid invoices ÷ quotes sent). That undercounts true sales performance because signed/active work hasn't been collected yet. Add a true **sales conversion**: quotes won (signed + active + paid) ÷ quotes sent.

### Definition

- **Denominator (sent):** any quote that left Draft — statuses `Sent. Awaiting Approval.`, `Approved and Signed`, `Awaiting Payment`, `Project In Progress`, `Paid`, `Cancelled`, `Rejected`. (Lost deals count against you — they were sent.)
- **Numerator (sold):** `Approved and Signed` + `Awaiting Payment` + `Project In Progress` + `Paid`.
- **Display:** `XX%` with sub `{won} sold / {sent} sent`.
- Keep the existing Quote → Paid KPI on the Pipeline page (collection-quality signal). Replace the home Firm Pulse "Conversion" tile with the new Sold metric since the hero is sales-focused.

### Changes

1. **`lib/firm-pulse.ts`** — Extend the loop to also count `wonCount` (signed+active+paid) and broaden `sentCount` to include lost. Update `conversion` shape to `{ pct, won, sent }`.

2. **`components/home/FirmPulse.tsx`** — Rename the Conversion tile label to "Quote → Sold", show `{won} sold / {sent} sent` as the sub.

3. **`components/pipeline/PipelineDashboard.tsx`** — Add a 6th KPI in row 1: "Quote → Sold" (emerald) alongside the existing "Quote → Paid". Compute `wonCount` and a broadened `sentCountWithLost` in the existing kpis useMemo. Grid becomes `lg:grid-cols-6` for row 1.

### Out of scope

- Time-windowing the conversion (YTD vs all-time). Stays all-time like today.
- Per-preparer conversion breakdown.
- Changing the bottom stage-buckets row.
