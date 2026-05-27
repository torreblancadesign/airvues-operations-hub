# Plan: Surface additional invoice fields on Money page

Mirror the Airtable invoice form fields shown in the screenshot across the data layer, side panel (`InvoiceSheet`), and create modal (`NewInvoiceModal`). Editable fields become editable in the side panel; computed/automation fields render as view-only.

## Fields to add

Classified from `lib/schema.ts` (table `Invoices`):

**Editable** (write via PATCH/POST):
- `Need Client Approval for Subscription Payment?` — singleSelect Yes/No
- `Payment Plan - Number of Payments` — number
- `Payment - Plan - Frequency` — singleSelect weekly/biweekly/monthly
- `Discount %` — percent (stored 0–1)
- `Discount Length (number of payments)` — number
- `Fiverr Status` — singleSelect (Gig Pending Acceptance / Gig Accepted / Gig Funds Cleared)

**View-only** (formula or set by Airtable automation after send):
- `Client Stripe Status` — formula
- `Invoice Stripe ID` — populated by automation
- `Subscription Stripe ID` — populated by automation
- (`Invoice Stripe Link` and `Subscription Stripe Link` already render as action buttons — keep as-is)

Already on the panel and untouched: Date, Description, Type, Amount, Payer, Source.

## Changes

### 1. `lib/money.ts`
Extend `MoneyInvoice` with the new fields and pull them in `listAllInvoices`:
```
needsClientApproval: "Yes" | "No" | null
paymentPlanCount: number | null
paymentPlanFrequency: "weekly" | "biweekly" | "monthly" | null
discountPercent: number | null   // 0–1 from Airtable
discountLength: number | null
fiverrStatus: string | null
clientStripeStatus: string | null
subscriptionStripeId: string | null
```
Add their field IDs to the `fields` array of the cached read.

### 2. `lib/mutations/invoice.ts`
- Extend `CreateInvoiceInput` with the six editable extras (all optional). Validate types/ranges (e.g. discount 0–1, counts 1–60, frequency/approval against enum).
- Map them into `fields` on `createInvoice` when present.
- Add a new server action `updateInvoice(id, patch)` that accepts the same editable subset (plus Date, Description, Type, Amount, Payer, Source so the panel can edit any editable field), runs `requireRole("admin","lead","editor")`, calls `patchRecords`, then `revalidateTag("airtable")` + `revalidateTag("money:all-invoices")`. Validate with the same helpers.

### 3. `components/money/InvoiceSheet.tsx`
- Replace the static `<Field>` rows for editable fields with inline edit controls (click-to-edit pattern: show value, "Edit" reveals input + Save/Cancel). Use `useTransition` to call `updateInvoice`. Show inline error on failure.
- Editable inline: Date, Description, Type, Amount, Source, Fiverr Status, Need Client Approval, Payment Plan # of Payments, Payment Plan Frequency, Discount %, Discount Length.
- View-only rows (new): Client Stripe Status, Invoice Stripe ID, Subscription Stripe ID. Keep existing read-only rows (Identifier, Created, Status Last Modified, Margin Profit, Initial, Approved, Stripe ID, Quotes, Record ID).
- Gate all edit affordances behind `canEdit`. When `!canEdit`, render plain values.
- Payer change is out of scope for inline edit (uses picker UI) — leave as display only for now; user can change it in Airtable. Note to user in plan.

### 4. `components/money/NewInvoiceModal.tsx`
Add optional inputs for the six editable extras, grouped sensibly:
- "Need Client Approval" (Yes/No radio) — only relevant when Type ≠ One-time, but render always; default unset.
- "Payment Plan – # of Payments" + "Payment Plan – Frequency" (only enable when Type is "Payment Plan" or "Recurring"; otherwise greyed).
- "Discount %" + "Discount Length" (always available).
- "Fiverr Status" (only enable when Source = "Fiverr").
Wire through to `createInvoice`. Convert Discount % input (user enters 0–100) to 0–1 before sending.

### 5. No schema/Airtable mutation outside the wrapper
All writes go through `patchRecords` / `createRecords` in `lib/airtable.ts` per project rules.

## Notes / decisions
- Inline edit, not modal-edit, in the side panel — matches existing minimal aesthetic and keeps the panel scannable.
- Payer edit deferred (separate UX). All other editable form fields covered.
- Discount stored as fraction in Airtable; UI shows whole %.
- Optimistic UI not added; rely on `revalidateTag` round-trip (consistent with rest of app).

## Files touched
- `lib/money.ts`
- `lib/mutations/invoice.ts`
- `components/money/InvoiceSheet.tsx`
- `components/money/NewInvoiceModal.tsx`
