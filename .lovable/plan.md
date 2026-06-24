## Problem

On the quote detail page (`app/(app)/pipeline/[id]/page.tsx`), the link to the account/client page currently renders `quote.client`, which is the **contact person's name** (from the Quotes `Client Name` lookup → People). The Accounts page shows the **company name** (`quote.company`, resolved via Prepared for → People → Companies). These don't match, so the link looks wrong.

Also, the link is small mono text in the breadcrumb row + an inline underline in the subtitle — easy to miss.

## Changes (presentational only, single file: `app/(app)/pipeline/[id]/page.tsx`)

1. **Use company name as the link label.**
   - Breadcrumb link: replace `{quote.client && quote.client !== "—" ? quote.client : "Account"}` with `quote.company ?? quote.client ?? "Account"`.
   - Subtitle: keep contact-person text as plain text (it's correctly labeled "Prepared by / for" context), and stop turning `quote.client` into the account link. The account link belongs on the company name, not the contact.

2. **Make the account button obvious.** Replace the faint breadcrumb-style "Account ↗" link with a real button placed next to the "Web Quote ↗" / "Airtable ↗" buttons in the action row:
   ```
   [ ← All quotes ]                       (breadcrumb only)

   <PageHeader ... />

   Status chips ...     [ View Account ↗ ] [ Web Quote ↗ ] [ Airtable ↗ ]
   ```
   - Style: same size as the other action buttons, neutral surface (`bg-bg-elevated border border-rule`), with the company name inline, e.g. `View account: Acme Corp ↗`.
   - Only render when `quote.companyId` is present; otherwise omit.

3. **Keep the breadcrumb minimal:** just `← All quotes` (or `← Back to client` when `fromClient` is set). Remove the duplicate company link from the breadcrumb row now that the prominent button covers it.

No data-layer, schema, or mutation changes. `quote.company` and `quote.companyId` are already returned by `lib/pipeline.ts`.

## Out of scope

- No changes to the Accounts page, QuoteSheetEditor, or the `client` field semantics elsewhere.
- Not renaming the `client` field in `PipelineQuote` (still used by tables/filters as the contact label).
