## Retainer-aware projects

### 1. Projects list — show proposal type
`components/pipeline/QuoteTable.tsx`
- Add a compact "Type" pill in the project-name cell (or as a new narrow column) showing `Retainer` (sky) vs `Airtable Solutions` (violet), based on `q.proposalType`. Filter bar already supports proposal type.

### 2. Project detail — hide irrelevant sections for retainers
`components/pipeline/QuoteSheetEditor.tsx`
- Read `quote.proposalType`. When it equals `"Retainer Agreement"`:
  - Hide the **Client input for proposal** section (lines ~1118–1178).
  - Hide the **AI-generated proposal content** section (lines ~1181 onward through its closing `</Section>`).
- Keep Project details, Quote calculator, Change orders for both types.

### 3. Quote calculator — monthly grouping for retainers
`components/pipeline/QuoteStoriesTable.tsx`
- Accept a new prop `groupByMonth: boolean` (true when `proposalType === "Retainer Agreement"`).
- When enabled, group rows by month derived from each story's `Created` date (format "MMMM YYYY", e.g. "June 2026"). Stories already expose a created timestamp via the schema (`fldy4b4PnNNGXkouC` autoNumber + Airtable `createdTime`); if not already fetched in `lib/quotes.ts`, add `createdTime` to the story fetch (uses Airtable's built-in record `createdTime`, no schema change).
- Render a sticky month header row above each group, sorted newest month first; within a month keep the existing `Quote Order` drag-and-drop sort.
- Add an "Add story to {Month YYYY}" button per group; new stories default to that month by setting their createdTime implicitly (Airtable does this automatically on create) and assigning a `Quote Order` at the end of that month's group.
- Drag-and-drop reordering stays within a single month (cross-month drags disabled for v1).
- For non-retainer quotes, behavior is unchanged (flat ordered list).

`components/pipeline/QuoteSheetEditor.tsx`
- Pass `groupByMonth={quote.proposalType === "Retainer Agreement"}` to `QuoteStoriesTable`.

### Notes
- No Airtable schema changes — month is derived from each story's Airtable `createdTime`.
- The earlier `dist-check` failure no longer reproduces (`tsc --noEmit` passes); will re-verify after edits with build.