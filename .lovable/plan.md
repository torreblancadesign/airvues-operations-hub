## Goal

Add a **Create AI Proposal** button inside the "Client input for proposal" section that flips the Airtable checkbox `Run AI Proposal Agent` to true, then polls until the AI/calc fields show up.

## Behavior

**Button placement:** new footer row inside the "Client input for proposal" section, below the documents attachment row.

**Disabled / grayed-out states (in order of precedence):**
1. User is read-only (`canEdit === false`).
2. **Inputs not filled out:** both `Custom Problem Statement` is empty AND no documents are attached. Tooltip: "Add a problem statement or attach documents first."
3. **Already running:** the `Run AI Proposal Agent` checkbox is currently true on the record (button shows spinner + "Generating proposal…").
4. **Already populated** (no re-runs from UI for now): if `recommendedApproach`, `recommendedApproachSummary`, `projectOverview`, `problemStatementSolution`, `estimateHoursRange`, and `estimateCostRange` are all non-empty AND at least one Story is linked, button is replaced with "Proposal generated · [Re-run]". Re-run is allowed but requires explicit click.

**On click:**
1. Server action sets `Run AI Proposal Agent = true` on the Quote.
2. Drawer enters "generating" state and starts polling.

**Polling:**
- Every 10 seconds, call `loadQuoteDetail(quoteId)`.
- Stop when the checkbox flips back to false (Airtable automation un-checks it at the end) OR after ~5 min timeout.
- On stop, refresh local quote state (drawer fields + stories table re-render with new AI-generated content).
- Poll loop is cancelled on drawer close, on quote switch, or on error.
- Show inline progress copy: "Generating proposal… usually 1–2 minutes" + a small ticking elapsed counter.

## Technical Changes

**`lib/quote-types.ts`**
- Add `runAiProposalAgent: boolean` to `QuoteDetail`.

**`lib/quotes.ts`** (`getQuoteDetail`)
- Read the `Run AI Proposal Agent` field by name (not in `schema.ts` yet — pass through `fields` array as a string literal, same pattern used elsewhere for non-regenerated fields).
- Map to `runAiProposalAgent` boolean (Airtable returns `true`/`undefined`).

**`lib/mutations/quote.ts`**
- New server action `triggerAiProposalAgent(quoteId)`:
  - Validates quoteId.
  - `gate()` (admin / lead / editor).
  - `patchRecords(Tables.Quotes.id, [{ id, fields: { "Run AI Proposal Agent": true } }])`.
  - `invalidateQuote(quoteId)`.
  - Returns refreshed `QuoteDetail`.

**`components/pipeline/QuoteSheetEditor.tsx`**
- Add `CreateAiProposalButton` block at the end of the "Client input for proposal" section.
- New local state: `aiTriggering` (during the initial mutation) and `aiPolling` (during the 10s polling loop) with a `pollStartedAt` timestamp for the elapsed counter.
- `useEffect` that starts a `setInterval(10_000)` when `aiPolling` is true, calls `loadQuoteDetail`, updates `quote` state, and stops when `runAiProposalAgent` flips back to false or timeout reached. Always cleans up on unmount.
- Compute `hasClientInput = customProblemStatement.trim().length > 0 || documents.length > 0`.
- Compute `aiContentReady = all six AI fields non-empty && stories.length > 0`.
- Render disabled-with-tooltip button until `hasClientInput`; show "Generating…" while `runAiProposalAgent === true`; show "Re-run" affordance when `aiContentReady`.

## Out of scope

- No new Airtable automation logic — we only flip the checkbox; the existing Airtable automation does the rest.
- No webhook/realtime updates; polling only.
- No edit to the AI output section UI itself (it just re-renders when the polled data arrives).
- No tracking of last-run timestamp beyond what's already on the record.
