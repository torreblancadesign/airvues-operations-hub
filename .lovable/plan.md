## Mapping team language → our schema

| Team term | Our schema |
|---|---|
| Saga | `Sagas` table (deferred — not needed now) |
| **Epic** | `Quotes` table (a.k.a. proposal) |
| **Story** | `Stories` table (proposal tasks) |

Wherever the StorySheet / Backlog currently says "Quote", we'll relabel to "Epic" in copy only (table + field names stay the same in Airtable). Internal code keeps using `quote*` to avoid a giant rename.

---

## 1. Make Sprint and Phase editable on the backlog

`Story.Phase` already exists as a single-select (`Phase 1 / 2 / 3`) but isn't editable anywhere in the app. `Story.📆Sprints` is only editable from `/sprints/[id]/plan`.

- **`lib/mutations/story.ts`**: extend `StoryPatch` with `phase?: string | null` and `sprintIds?: string[]`; map to `"Phase"` and `"📆Sprints"` in `buildStoryFields`.
- **`lib/engineering-types.ts`**: add `phase: string | null` to `Story`.
- **`lib/engineering.ts`**: read the `Phase` field into the Story shape.
- **`components/engineering/StorySheet.tsx`**: add two new editable `Field` blocks — **Sprint** (select populated from a new `sprints` prop: `{id, label, status}[]`) and **Phase** (select: Phase 1 / 2 / 3 / —).
- **`components/backlog/BacklogList.tsx`** + **`app/(app)/backlog/page.tsx`**: pass a `sprints` list down to StorySheet (reuse `getEngineeringBoard().sprints` or load via `lib/sprints.ts`).
- The kanban drawer on `/sprints/[id]` reuses StorySheet — pass `sprints` there too.

(Inline edit directly in the BacklogRow is deferred; the drawer covers the same use case with less risk.)

## 2. Agile language relabel

- StorySheet: section label **"Quote" → "Epic"**, action button **"Open in Airtable ↗"** unchanged, but the section title and the URL anchor text become "Epic".
- BacklogList table header: **"Quote" column → "Epic"**.
- No data-model changes; pure copy.

## 3. Epic Owner on Quotes (Proposals)

Goal: every Epic (Quote) has one main engineer responsible for delivery.

- **Airtable schema change (manual, documented in plan output)**: add a new field `Epic Owner` on the `Quotes` table — `multipleRecordLinks` → `People`, single-select-style (we'll enforce one in UI). The user creates this field in Airtable; we then re-run `scripts/regenerate-schema` to refresh `lib/schema.ts`.
- **`lib/pipeline.ts` + `lib/quote-types.ts`**: surface `epicOwnerId / epicOwnerName` on the `PipelineQuote` shape.
- **`components/pipeline/QuoteSheetEditor.tsx`**: add an "Epic Owner" picker (reuse `PersonPicker`) that PATCHes Quotes.`Epic Owner`.
- **`lib/mutations/quote.ts`**: extend the existing quote-update action with `epicOwnerId?: string | null`.
- **StorySheet**: show the Epic Owner as read-only context under the Epic link ("Owner: Jane Doe") so engineers know who runs the proposal.

## 4. Comments on stories

Goal: engineers can explain blockers / why a story is incomplete.

- **Airtable schema change**: add `Comments` (multilineText) field on `Stories` table. (Existing `Developer Notes` is close but unused/single-author-feeling — the team explicitly asked for "a comment section". A single multiline field is the minimum viable; threaded comments are out of scope.)
- **`lib/engineering-types.ts`** + **`lib/engineering.ts`**: include `comments: string | null`.
- **`lib/mutations/story.ts`**: extend `StoryPatch` with `comments?: string | null`.
- **`components/engineering/StorySheet.tsx`**: new editable textarea block titled "Comments" with hint *"Use to explain blockers or why a story is incomplete."* Save on blur (same pattern as Description).

If the team later wants per-author threaded comments, we'd promote this to a child Airtable table — flagged as deferred.

## 5. Duplicate story → push duplicate to next sprint

Use case: a story turns out to be bigger than expected; engineer wants to clone it and move the clone to next sprint as a placeholder (knowing it may later be split).

- **`lib/mutations/story.ts`**: new action `duplicateStoryToNextSprint(storyId)`:
  1. `requireRole("admin","lead","engineer","editor")`.
  2. Load the source story (fields: Story Name, Hours, Invoice, Priority, Assignee, Quote, Description, Phase, current Sprint).
  3. Resolve "next sprint" = the `Sprints` record whose `Sprint Status === "Next"`. If none, return `{ error: "No 'Next' sprint exists — create one in /sprints first." }`.
  4. `createRecords(Stories)` with: `Story Name = "<original> (cont.)"`, same Hours/Invoice/Priority/Assignee/Quote/Phase/Description, `Story Status = "Todo"`, `📆Sprints = [nextSprintId]`.
  5. Invalidate caches.
- **StorySheet action bar**: new "Duplicate → Next sprint" button (visible when `canEdit`), with a confirm modal:
  > "This will create a copy of *<story name>* in the next sprint. You can split it later if needed."
- After success, flash "Created story #N in Sprint #M" + a link.

---

## Out of scope / deferred

- Saga UI (team said "not important for now").
- Inline-edit Sprint/Phase directly in the backlog row (drawer covers it).
- Threaded/per-author comments (single multiline first).
- Auto-splitting a duplicated story across sprints (manual today; just duplicates).

## Manual Airtable steps the user must do before code ships

1. Add `Epic Owner` (multipleRecordLinks → People) on the **Quotes** table.
2. Add `Comments` (multilineText) on the **Stories** table.
3. Ping me to re-run `scripts/regenerate-schema` so `lib/schema.ts` picks up the two new field IDs.

## Verification

`npx tsc --noEmit` → `npm run build` → in preview: open a backlog story, edit Sprint + Phase + Comments; on `/pipeline` set an Epic Owner; click "Duplicate → Next sprint" and confirm a new Todo story appears in the Next sprint.
