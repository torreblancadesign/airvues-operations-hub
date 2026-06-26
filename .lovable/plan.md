## Hide deadline badge for Paid projects

In `components/pipeline/QuoteTable.tsx` (around line 190–196), wrap the deadline badge render so it only shows when `q.status !== "Paid"`. Also hide on the project detail page (`app/(app)/pipeline/[id]/page.tsx`, the deliveryDueDate chip in the status row) using the same condition for consistency.

No data-layer changes — deadline data stays available; we just suppress the visual cue once the deal is fully paid/completed.