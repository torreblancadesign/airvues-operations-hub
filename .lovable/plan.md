## Goal
Add a "Run AI Change Order Agent" button that mirrors the existing Create AI Proposal button, but flips the Airtable `Run AI Change Order Agent` checkbox. Place it inside the collapsible **Change Order Input Details** block (the only collapsible in the Change orders section).

## 1. Schema + types
- `lib/schema.ts` (Quotes table): add `"Run AI Change Order Agent": { id: "Run AI Change Order Agent", type: "checkbox" }`.
- `lib/quote-types.ts`: add `runAiChangeOrderAgent: boolean` to `QuoteDetail`.
- `lib/quotes.ts`: add `"Run AI Change Order Agent"?: boolean` to `QuoteFields` and populate `runAiChangeOrderAgent: f["Run AI Change Order Agent"] === true` in the returned detail.

## 2. Mutation
- `lib/mutations/quote.ts`: add `triggerAiChangeOrderAgent(quoteId)` mirroring `triggerAiProposalAgent` — patches `{ "Run AI Change Order Agent": true }`, invalidates, returns refreshed `QuoteDetail`.

## 3. UI — `components/pipeline/QuoteSheetEditor.tsx`
- Import `triggerAiChangeOrderAgent`.
- Add a small `CreateAiChangeOrderRow` component (or parameterize the existing `CreateAiProposalRow`; new component is simpler and keeps the proposal row untouched). Same visual shell: muted status copy on the left, emerald primary button on the right, spinner while running, elapsed timer, error line.
  - Disabled reasons: read-only OR `changeOrderInputDetails` is empty (no context to feed the agent).
  - Labels: `Create Change Order` (idle, no existing summary) / `Re-run Change Order` (existing summary present) / `Generating change order…` (running) / `Starting…` (triggering).
  - "Ready" copy when summary exists: `Change order generated. Edits below override AI output.`
- Add state + handler in the main editor: `coAiTriggering`, `coAiError`, `coPollStartedAt`, `coPollTick`, `isCoAgentRunning = quote?.runAiChangeOrderAgent === true`, plus a polling `useEffect` mirroring the proposal one (10s interval, 5-min cutoff).
- Render `<CreateAiChangeOrderRow … />` **inside** the `CollapsibleFieldWrapper` for `Change Order Input Details`, below the `<TextField>`, so it appears only when the section is expanded. Pass `aiContentReady = quote.changeOrderDetails.trim().length > 0`.

## Out of scope
- The Airtable automation itself (assumed already wired to the new checkbox field, same pattern as the proposal agent).
- Any change to the proposal agent button.

## Technical notes
- Two independent pollers will run when both agents are active; that's fine — each keys off its own checkbox.
- Both pollers refresh the same `quote` state via `loadQuoteDetail`, so cross-agent updates stay in sync.
