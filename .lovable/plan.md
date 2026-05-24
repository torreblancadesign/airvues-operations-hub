## Goal

Make the two "status" fields on a Quote unambiguous everywhere they appear in the dashboard, without touching Airtable field names or data.

## The two fields, restated

| Airtable field | What it actually tracks | Audience | Examples |
|---|---|---|---|
| `Status` | Internal sales/quote lifecycle — where the **proposal document** is in our workflow | Us (internal) | Draft · Sent. Awaiting Approval · Approved and Signed · Awaiting Payment · Paid · Cancelled · Rejected · Auditing 🚩 |
| `Project Status` | Client-facing delivery milestones — where the **engagement** is in the 7-stage journey shown on the web quote | Client (visible) | Proposal Created → Proposal Accepted → Proposal Signed → Commencement Invoice Paid → First Draft Delivered → Project Accepted → Completion Invoice Paid |

So: one is *"what is the paperwork doing?"*, the other is *"how far along is the actual project the client sees?"*.

## Proposed display labels (UI only — Airtable fields untouched)

- `Status` → **"Deal Stage"** (internal sales pipeline)
- `Project Status` → **"Client Journey"** (client-facing delivery milestones)

Alternative pairs if you prefer different wording — pick one set, I'll apply it everywhere:

1. **Deal Stage** / **Client Journey** ← recommended, clearest split
2. **Sales Status** / **Delivery Stage**
3. **Quote Status** / **Project Phase**
4. **Internal Status** / **Client-Visible Stage**

## Where the relabel lands

Pipeline table (`components/pipeline/QuoteTable.tsx`):
- Header "Status" → new internal label (e.g. "Deal Stage")
- Header "Project" (the progress bar column) → new client label (e.g. "Client Journey")
- Add a tiny `?` info icon on each header → hover tooltip with the one-line definition

Quote drawer (`components/pipeline/QuoteSheet.tsx` + `QuoteSheetEditor.tsx`):
- Header strip's mono "Status" chip relabeled
- Editor section currently labeled "Project Status" relabeled to match
- Add a one-line helper under each field: *"Internal sales pipeline — not shown to client"* / *"Client-visible delivery milestone — appears on the web quote"*

Filter bar (`components/pipeline/FilterBar.tsx`):
- Stage filter dropdown labeled with the new internal name

Legend / discoverability:
- Add a small inline legend above the 7-segment bar in the drawer showing the 7 stages with the current one highlighted (replaces the hover-only tooltip you have to discover)
- Keep the same compact bar in the table row (tooltip stays), since space is tight

Out of scope (per your earlier "no Airtable changes" rule):
- Renaming the actual Airtable fields
- Changing the 7-stage values, the internal Status enum, or any mutation logic
- Adding/removing columns

## Implementation notes (technical)

- Centralize the two labels + their tooltip copy in a tiny `components/pipeline/labels.ts` (e.g. `DEAL_STAGE_LABEL`, `DEAL_STAGE_HELP`, `CLIENT_JOURNEY_LABEL`, `CLIENT_JOURNEY_HELP`) so future renames are one-file changes.
- All underlying types (`PipelineQuote.status`, `PipelineQuote.projectStatus`, `QuoteDetail.status`, `QuoteDetail.projectStatus`) keep their current names — this is pure display.
- No data-layer, mutation, or schema files change.

## Question before I build

Which label pair do you want? (1 Deal Stage / Client Journey is my pick, but say the word and I'll use any of the others — or your own wording.)
