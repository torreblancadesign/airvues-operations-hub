## Question 1: yes

The "Days left" badge in the Projects table is computed from the **Client Delivery Due Date** field on the Quote (Airtable column → `deliveryDueDate` in code). `lib/deadline.ts › computeDeadlineRisk()` does `floor((dueDate − now) / 1 day)` and buckets it: `overdue < 0 ≤ red ≤ 3 < yellow ≤ 7 < ok`. The label ("Due today", "5d left", "Overdue by 2d") comes from `deadlineRiskLabel()`. If the date is empty, it shows "—". So editing the new field on the quote page will directly move the Projects-page badge.

## Question 2: add Delivery Due Date to the quote details editor

Wire the same `Client Delivery Due Date` field already used on the Projects list into the editable header on the quote detail page.

### Changes

**1. `lib/quote-types.ts`**
- Add `deliveryDueDate: string | null` to `QuoteDetail`.
- Add `deliveryDueDate?: string | null` to `QuoteFieldPatch`.

**2. `lib/quotes.ts` (`getQuoteDetail`)**
- Include `Tables.Quotes.fields["Client Delivery Due Date"].id` in the requested fields.
- Map `f["Client Delivery Due Date"]` → `deliveryDueDate` on the returned object.

**3. `lib/mutations/quote.ts` (`updateQuoteFields`)**
- Validate: if provided and non-empty, must match `^\d{4}-\d{2}-\d{2}$` (same shape as `preparedDate`).
- Patch mapping: `fields["Client Delivery Due Date"] = patch.deliveryDueDate || null`.
- Include the key in the allow-list / `if (patch.deliveryDueDate !== undefined)` branch.

**4. `components/pipeline/QuoteSheetEditor.tsx`**
- Add a new `<FieldRow label="Delivery due date" hint="Client Delivery Due Date — drives the deadline badge on the Projects page.">` directly after the existing "Prepared date" row (line ~1033).
- Same `<input type="date">` pattern as Prepared date, bound to `quote.deliveryDueDate`, calling `patchAndRefresh("deliveryDueDate", { deliveryDueDate: e.target.value || null })`.
- Disabled when `!canEdit`.

**5. `app/(app)/pipeline/[id]/page.tsx`** — no change. The page already shows the deadline pill from `quote.deliveryDueDate` (from `listAllQuotes`); after the edit and `revalidateTag("airtable")`, both the detail header chip and the Projects list row update on next render.

### Verify

- `npx tsc --noEmit`
- `npm run build`
- Open a quote detail page → new "Delivery due date" row appears below Prepared date → change the date → the orange/red "Deadline" pill above updates after refresh, and the Projects page row reflects the new value.

### Out of scope

Filters, KPI tiles, deadline-risk thresholds, any other field, mobile-specific styling.