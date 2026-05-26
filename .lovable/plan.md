## Goal
Enhance `/money` in place with:
1. A focused header strip (Total Outstanding + Paid MTD/YTD).
2. A "New invoice" modal that creates an Airtable record only.
3. A "Send" action on an existing invoice that flips status → `sent`, which triggers Airtable's existing automation to actually issue the invoice.

Quote sheet stays unchanged.

## Scope

### 1. Header metric strip
Two oversized hero cards above the existing "This Month" block:
- **Total Outstanding (AR)** — sum of `open` + `sent` + `unsent` + `past due`. Sub: "X current · Y late".
- **Paid** — toggleable between MTD and YTD (default MTD). Sub: invoice count.

Values come from the existing `kpis` memo in `MoneyDashboard.tsx`; add a tiny YTD addition.

### 2. "New invoice" modal (create record only)
- **Button**: "+ New invoice" in `PageHeader` meta on `/money`, gated by `canMutate()`.
- **Modal** (`components/money/NewInvoiceModal.tsx`):
  - Payer (Company) — searchable picker
  - Linked Quote — optional, searchable
  - Amount (currency, required, > 0)
  - Date (defaults to today)
  - Type — One-time / Recurring / Payment Plan
  - Source — Stripe / Fiverr / Other (default Other)
  - Description (optional, multiline)
  - **Status is hard-coded to `unsent`** — not user-editable. No "Create and Send Invoice" checkbox toggled.
- **Server action** `createInvoice` in `lib/mutations/invoice.ts`:
  - `requireRole("admin", "lead", "editor")`
  - Zod-validate
  - `createRecords(Tables.Invoices.id, [{ fields: { ... } }])` — schema field names, `typecast: true` already on
  - `revalidateTag("airtable")` + `revalidateTag("money:all-invoices")`
  - Returns `{ ok, id }` or `{ error }`

### 3. "Send" action on existing invoices
- In `InvoiceSheet`, when the row's status is `unsent`, show a primary **"Send invoice"** button (gated by `canMutate()`).
- Clicking it calls a new server action `markInvoiceSent(id)`:
  - `requireRole(...)`
  - `patchRecords(Tables.Invoices.id, [{ id, fields: { "Invoice Status": "sent" } }])`
  - Revalidate the same tags
  - Returns `{ ok }` or `{ error }`
- The Airtable side already has an automation that fires on status = `sent` to actually create the Stripe invoice. We just flip the field.
- Optional confirm step ("This will send the invoice to the payer. Continue?") to prevent accidental fires.

### 4. Quote sheet
No change.

## File changes

**New**
- `components/money/NewInvoiceModal.tsx` — client modal with pickers + validation
- `lib/mutations/invoice.ts` — `createInvoice` + `markInvoiceSent`
- `lib/companies-light.ts` — `{id, name}[]` for company picker (only if no existing helper)

**Edited**
- `app/(app)/money/page.tsx` — pass `canEdit`, companies-light, quotes-light into dashboard; "+ New invoice" trigger
- `components/money/MoneyDashboard.tsx` — accept props, render hero strip, mount modal
- `components/money/InvoiceSheet.tsx` — conditional "Send invoice" button when status is `unsent`

## Technical notes

- All writes via `lib/airtable.ts` (`createRecords`, `patchRecords`).
- Field references via `Tables.Invoices.fields[...]` keys per CLAUDE.md #3.
- Status values are lowercase per `lib/schema.ts:273` — `unsent`, `sent`, etc.
- Auth: UI gated by `canMutate()`; server enforced by `requireRole`.
- No Stripe API calls; Airtable's existing automation owns invoice issuance.

## Verification
- `npx tsc --noEmit` + `npm run build`
- As admin on `/money`: hero strip renders, "+ New invoice" visible, creates record with `unsent` status, row appears.
- Open the new invoice → "Send invoice" button visible → click → status flips to `sent` → Airtable automation handles the rest.
- As engineer: both buttons hidden.
