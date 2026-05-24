## Goal

Turn the read-only `QuoteSheet` drawer (opened from `/pipeline`) into an editable workspace with four clear sections, mirroring the Airtable fields and labelling client-visible fields explicitly.

## Sections (in order, inside the drawer)

### 1. Header — quote identity (editable, client-visible)

Section label: **"Quote details"** with a small chip on each field saying `Client visible 👁`.

| Display label | Airtable field | Input |
|---|---|---|
| Project name | `Project Name` | text |
| Prepared by | `Prepared by` (linked → People) | searchable single-select (People) |
| Prepared date | `Prepared Date` | date |
| Prepared for | `Prepared for` (linked → Clients) | searchable single-select (Clients) |
| Project status | `Project Status` | single-select (existing options) |
| Proposal type | `Proposal Type` | single-select (existing options) |

Autosave on blur / select change.

### 2. Client input — collapsible, internal-only

Section label: **"Client input for proposal"** + small "Internal only" tag. Collapsed by default (chevron toggle).

- **Custom Problem Statement and Solution Summary** → label "Paste all information from client for proposal (meeting transcripts, emails, requirements, etc.)" — large multiline textarea, autosave on blur.
- **Documents needed for Proposal** → label "Attach any documents from client (requirements, screenshots, etc.)" — Vercel Blob uploader + thumbnail list, identical pattern to `attachLeadFiles` in `lib/mutations/lead.ts`.

### 3. AI proposal output — client-visible, read-only by default

Section label: **"AI-generated proposal content"** with `Client visible 👁` tag. Each field has a small "Edit" toggle (the AI agent owns these, but humans can override).

| Display label | Airtable field |
|---|---|
| Recommended Approach (Portal Visible 🖥️) | `Recommended Approach` (richText → render + edit as plain multiline) |
| Recommended Approach Summary (Portal Visible 🖥️) | `Recommended Approach Summary` |
| Project Overview (Portal Visible 🖥️) | `Project Overview` |
| Problem Statement & Our Solution (Portal Visible 🖥️) | `Problem Statement & Our Solution` |
| Estimate Hours Range (Portal Visible 🖥️) | `Estimate Hours Range` |
| Estimate Cost Range (Portal Visible 🖥️) | `Estimate Cost Range` |

### 4. Quote calculator — Stories table

Header strip with **Total Cost** (from `Quotes."Total Cost"` rollup) shown large + total hours secondary, and an `+ Add story` button on the right.

Stories table (matches the attached screenshot layout):

| Column | Story field |
|---|---|
| Story Name | `Story Name` |
| Description | `Description` (truncated) |
| Hours | `Hours` |
| Cost | `Cost` (currency; `Invoice` is the legacy alias — use `Cost`) |
| Client Notes | `Client Notes` |
| Story Status (Internal Only) | `Story Status` |
| Engineer Assigned (Internal Only) | `Assignee` (people, comma-separated names) |

`+ Add story` opens a small inline modal (reusing `components/backlog/NewStoryModal.tsx` pattern) that creates a Story and links it to the current quote via the Story `Quote` field, then revalidates.

## Files to add / change

**New**
- `lib/quotes.ts` (server): `getQuoteDetail(quoteId)` → full quote fields + linked stories (Story Name, Description, Hours, Cost, Client Notes, Story Status, Assignee names). Cached with tag `quote:${id}`.
- `lib/quote-types.ts`: client-safe `QuoteDetail`, `QuoteStoryRow`, `QuotePatch`.
- `lib/mutations/quote.ts` (server actions, all gated by `requireRole("admin","lead","editor")` + `revalidateTag("airtable")` + `revalidateTag("quote:${id}")` + `revalidateTag("pipeline:all-quotes")`):
  - `updateQuoteFields(quoteId, patch)` — handles all header + AI fields + Custom Problem Statement.
  - `attachQuoteDocuments(quoteId, files[])` — clone of `attachLeadFiles`, writes to `Documents needed for Proposal`.
  - `createQuoteStory(quoteId, input)` — creates Story linked to the quote.
- `lib/uploads.ts` already exposes the Vercel Blob upload helper used by leads — reuse.
- `components/pipeline/QuoteSheetEditor.tsx` — new client component that renders the four sections, owns local form state, calls the server actions.
- `components/pipeline/QuoteStoriesTable.tsx`
- `components/pipeline/NewQuoteStoryModal.tsx`
- `components/pipeline/PeoplePicker.tsx` / `ClientPicker.tsx` — small typeahead-style single-select for linked-record fields (sourced from existing `lib/people.ts` + `lib/clients.ts`).

**Edited**
- `components/pipeline/QuoteSheet.tsx` — replace current static body with a wrapper that fetches `getQuoteDetail` (via a thin server action invoked on open) and renders `QuoteSheetEditor`. Keep the header strip (total cost, status pill, stale badge) and the existing top action buttons.
- `components/pipeline/PipelineDashboard.tsx` — pass nothing new (selection still by `selected.id`).
- `lib/pipeline.ts` — no change to list query; detail comes from new `lib/quotes.ts`.

## Behaviour notes

- Autosave per field on blur (text) or change (selects/date). Show a small "Saved" / spinner indicator next to section title. No global save button.
- Client-visible chip on every header field + each AI section field. Internal-only chip on section 2 and on the two "Internal Only" story columns.
- Section 2 starts collapsed; remember open/closed state in `localStorage` keyed by `quote:${id}:clientInput`.
- AI section fields are read-only with per-field "Edit" pencil → switches to textarea + Save/Cancel (avoids accidental overwrites of the AI agent output).
- Stories table reads from `getQuoteDetail`; `+ Add story` revalidates `quote:${id}` so the table + total refresh.
- All write paths gated by `requireRole("admin","lead","editor")` — engineers/clients see read-only.

## Out of scope (call out)

- Editing existing stories inline (only create new + view). Story-level edits already live in `/backlog` and `StorySheet`.
- Removing/unlinking stories from a quote.
- Persisting the open/closed state of section 2 server-side.
- Re-running the AI proposal agent from this UI.
