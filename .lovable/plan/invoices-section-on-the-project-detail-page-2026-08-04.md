# Invoices section on the project detail page

Add an "Invoices" section at the bottom of the project (quote) detail page so invoices linked to that project are visible without going to the client page.

## What you'll see

- A new collapsible **Invoices** section at the bottom of `/pipeline/[id]`, below the Project log.
- Columns: #, Date, Description, Type, Status, Amount — same look and behavior as the Invoices table on the client page.
- Section header shows a summary: number of invoices, total invoiced, and outstanding (non-paid, non-void) amount.
- Clicking a row opens the existing invoice drawer (`InvoiceSheet`) for full detail and editing, exactly as on the client page.
- Empty state: "No invoices linked to this project."

## Technical details

- Data: reuse `listAllInvoices()` from `lib/money.ts` in the server component `app/(app)/pipeline/[id]/page.tsx`, filtered to invoices whose `quoteRecordIds` include `params.id`; sorted by date descending.
- New client component `components/pipeline/QuoteInvoices.tsx` — receives the filtered `MoneyInvoice[]` plus `canEdit`, renders the table inside the shared `Section` primitive (tone `amber`, `storageKey={qs:${quoteId}:invoices}`) and manages the selected-invoice state for `InvoiceSheet`.
- No Airtable schema, mutation, or permission changes; read-only listing plus the existing invoice drawer's edit path.
