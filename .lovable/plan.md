## What I found via the Airtable gateway

Inspected the live `Quotes` table to see what each lookup field actually returns:

- `Existing Company? (from Form Submission)` → returns **company record IDs** (e.g. `recDtOdpOpSo8fmoy`) ✓ — current mapping in `lib/pipeline.ts` is correct.
- `Client Name` → returns **person names** (e.g. "Jesse Webb", "Mauricio Abascal"), NOT company names.

So the current code in `lib/client-detail.ts` has two problems:

1. The fallback `q.client === companyName` compares a **person's name** to a **company name** → never matches → only quotes that have `Existing Company? (from Form Submission)` populated show up.
2. Many quotes don't have that lookup populated at all (no form submission, or the lookup hasn't propagated), so the company page shows zero projects even when there are clearly related quotes for that client.

## Fix plan

A quote can reliably be linked to a company through a second hop: `Quotes."Prepared for"` (a direct People link, field id `fldBR8ksKYyHDWQUV`) → `People.Company` → Company recId. We already build the `personId → companyId` map in `getClientDetail` for invoices; reuse it for quotes.

1. **`lib/pipeline.ts`** — extend `PipelineQuote` and `listAllQuotes`:
   - Add `preparedForIds: string[]` (sourced from `Prepared for` recIDs).
   - Add the field to the `fields:` request so it's actually fetched.

2. **`lib/client-detail.ts`** — replace the buggy name fallback with the person hop:
   ```ts
   projects = allQuotes.filter(q =>
     q.companyIds.includes(companyId) ||
     q.preparedForIds.some(pid => personToCompany.get(pid) === companyId)
   )
   ```
   Remove the `q.client === companyName` branch entirely (it was matching person→company names and is misleading).

3. **No schema, no UI, no write-path changes.** Cache tags stay the same.

## Verification

- Reload `/clients/<id>` for a company that has at least one Person assigned and at least one quote prepared for that person → Projects tab populates.
- Cross-check: count of projects shown on the client page should be ≥ quotes whose `Existing Company?` lookup already resolves to that company.
- No regressions on `/pipeline` (only adds an extra field to the fetch).

## Out of scope

- Adding a `Companies → Quotes` rollup in Airtable (would be the cleanest long-term fix but is a schema change).
- Industry/Lead Source/Discount blueprint fields — still Phase 7.
- Editing or write paths.
