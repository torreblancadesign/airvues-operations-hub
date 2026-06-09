## What's wrong

The Airtable connection works (the `/clients` list page shows real revenue and contact counts using the same token). The bug is in how `lib/client-detail.ts` queries Airtable for the *single* company view.

### Root cause #1 — Contacts query never matches
```ts
filterByFormula: `FIND('${companyId}', ARRAYJOIN({Company}))`
```
`{Company}` on the People table is a **linked-record** field. In Airtable formulas, `ARRAYJOIN()` on a linked field returns the **primary field text** of the linked record (the company *name*), not its `recXXXX` id. So `FIND('recABC...', 'Acme, Globex')` is always 0 → 0 contacts returned.

### Root cause #2 — Invoices depend on contacts
```ts
const payerIds = new Set(contacts.map((c) => c.id));
const companyInvoices = invoices.filter(inv => payerIds.has(inv.payerRecordId))
```
Because contacts is empty (bug #1), invoices is empty, which makes **Lifetime Revenue, Outstanding AR, Invoice Count, Last Invoice Date** all zero.

### Root cause #3 — Projects mapping is unverified
`PipelineQuote.companyIds` is sourced from the lookup field `"Existing Company? (from Form Submission)"`. Lookups of linked-record fields *can* return record IDs, but this needs to be verified against live data — if it returns names or empty, projects will never match either.

## Fix plan

1. **Rewrite `getClientDetail` to mirror the proven pattern in `lib/clients.ts`:**
   - Drop `filterByFormula` for People. Use `listRecordsCached` to fetch all People (already cached project-wide) and filter in JS: `people.filter(p => (p.fields.Company ?? []).includes(companyId))`.
   - Same for invoices: build `personId → companyId` map from the People list, then filter the full invoice list (already cached as `money:all-invoices`).
   - This is a tiny perf change — both lists are already loaded once and reused across the app via the `airtable` cache umbrella.

2. **Verify project linkage via the Airtable gateway** (build-mode only):
   - Call `GET /v0/{baseId}/Quotes?fields[]=Existing Company? (from Form Submission)&maxRecords=3` through the connector gateway.
   - If the lookup returns company record IDs → current code is correct, just needed the contact fix.
   - If it returns names → switch `PipelineQuote.companyIds` to be sourced via a 2-hop join: fetch Form Submissions, build `formSubmissionId → companyIds[]`, then map Quote → Form Submission → Company. Or add a rollup/formula in Airtable that exposes the company recId.

3. **Add a tiny diagnostic log** during the fix (one-time, removed before commit) printing the resolved counts so we can confirm contacts/invoices/projects each ≥ 1 for a known company (e.g. the one the user just opened).

4. **No Airtable schema changes required.** Re-use existing fields. No mutations.

## Files touched
- `lib/client-detail.ts` — rewrite the data fetcher (contacts, invoices, possibly projects mapping)
- `lib/pipeline.ts` — only if step 2 shows the lookup field doesn't carry record IDs

## Out of scope
- UI changes to `ClientDetailView.tsx` (the UI is fine, it just had nothing to render)
- Blueprint extension fields (Industry, Lead Source, Discount %) — still Phase 7
- Editing / write paths

## Verification
- Reload `/clients/<id>` for a company that has invoices on the list page; KPI tiles should now show non-zero Lifetime Revenue matching the list page.
- Contacts table populates with the same count as the list page's `contactCount`.
- Projects tab shows the quotes that are visible on `/pipeline` filtered by that client name.
