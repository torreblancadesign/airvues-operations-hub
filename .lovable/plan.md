## Change

Rename the second KPI card on `/pipeline` from **Collected YTD** → **Delivered YTD**. Same underlying metric (quotes with status `Paid`, prepared YTD) — just a clearer label that conveys "project finished and paid".

## Implementation

`components/pipeline/PipelineDashboard.tsx` — single string change on the StatCard label. The sub-line (`N paid · $X still owed`) stays as-is since for Paid quotes `amountOwed` should be ~0 and any residual is still meaningful.

## Out of scope

- Variable names in the `kpis` memo (`collectedYtd`, `collectedYtdCount`, `collectedYtdOwed`) stay as-is — internal naming, no user impact.
- No other cards change.

## Verification

- `/pipeline` row 1 reads: **Booked YTD · Delivered YTD · Open pipeline · Active work · Quote → Paid**.
