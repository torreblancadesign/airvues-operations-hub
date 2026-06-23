## Fix: Projects "Company" column is empty

The current source is `Tables.Quotes.fields["Company Name"]` — a stale lookup on the Quotes table that's mostly empty. Replace it with a resolved value derived from the quote's **Prepared for** (People) → People.**Company** (Companies) → Companies.**Name**.

### Where it's used

`lib/pipeline.ts › listAllQuotes()` sets `company: first(f["Company Name"] as string[])`. That `company` string is rendered in the Projects table (`components/pipeline/QuoteTable.tsx`) and in the quote detail header (`app/(app)/pipeline/[id]/page.tsx`).

### Changes

**1. `lib/pipeline.ts`** — resolve company server-side in `listAllQuotes()`:

- Stop requesting / reading `t.fields["Company Name"]` (the deprecated lookup). Keep the `companyIds` field exactly as-is (still used elsewhere for `?companyId=` deep-link filtering).
- After the quotes fetch, collect `preparedForIds` across all quotes (dedupe). If empty, skip. Otherwise, one cached batch read:
  ```
  listRecordsCached(Tables.People.id, {
    filterByFormula: OR(RECORD_ID()='rec1', ...),
    fields: [Tables.People.fields["Company"].id],
  }, ["pipeline:prepared-for-people"])
  ```
  → build `personId → companyId` map (first id from the `Company` link array).
- Collect unique companyIds from that map, then one cached batch read:
  ```
  listRecordsCached(Tables.Companies.id, {
    filterByFormula: OR(...),
    fields: [Tables.Companies.fields["Name"].id],
  }, ["pipeline:companies"])
  ```
  → `companyId → name` map.
- For each quote: pick the first `preparedForIds[0]`, look up its companyId, then companyName. Fall back to `null` (renders as "—") when missing. Do NOT fall back to the deprecated lookup.

**2. Type cleanup**

- Remove `"Company Name"?: string[]` from the inline `QuoteFields` type in `lib/pipeline.ts`.
- `PipelineQuote.company` stays `string | null` — no consumer changes.

**3. Nothing else changes**

- `QuoteTable` still renders `q.company ?? "—"`.
- Quote detail header still shows the resolved name.
- Airtable caching: 5-min cache (same as quotes), so the extra two reads are amortized.

### Out of scope

- Don't touch `companyIds` semantics, deep-link filters, `/clients` page, or the deprecated lookup field in Airtable.
- Don't fix multi-contact quotes specially; first `Prepared for` wins (matches today's behavior for the email/name).

### About the `dist-check failed` notice

Local `npx tsc --noEmit` exits clean and `npm run build:dev` is just `tsc --noEmit`. Nothing in the current source tree triggers the failure — it was almost certainly a stale signal from the previous run before the delivery-due-date edits landed (those resolved the only outstanding TS error: `Property 'deliveryDueDate' is missing`). I'll re-run typecheck + `npm run build` after the pipeline change to confirm green.

### Verify

- `npx tsc --noEmit`
- `npm run build`
- Load `/pipeline` → Company column populated for quotes whose Prepared-for person has a Company linked.
- Load a quote detail page → header subtitle still renders.