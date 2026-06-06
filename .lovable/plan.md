## Goals

1. **Epic Owner** on the quote drawer only lists internal + active people.
2. **Story details** can assign a sprint, and only current (`In Progress`) or future (`Next`) sprints are selectable — never past (`Done`).
3. **Sprint plan page** is rebuilt as a pure planning surface: per-engineer per-sprint capacity, easy story assignment, no money/commission anywhere, engineers limited to `Role = Engineer` + `Status = Active`.

---

## 1. Epic Owner picker — internal & active only

`components/pipeline/QuoteSheetEditor.tsx` (around line 786):

- The `people` prop is already `PersonOption[]` with `isInternal` / `isActive` flags (see `lib/quotes.ts:listPeopleOptions`).
- Replace `options={people}` for the Epic Owner `PersonPicker` with `options={people.filter(p => p.isInternal && p.isActive)}`.
- Leave the existing `Prepared by` / `Prepared for` pickers untouched (Prepared for needs externals).

No backend changes; no new types.

---

## 2. Sprint picker on Story details

### 2a. Data — surface sprint options to every caller

`lib/engineering.ts` already returns `sprintOptions: { id, number, status }[]` on the board. Reuse it:

- `app/(app)/me/page.tsx`, `components/me/PersonScorecard.tsx` — pass through `sprints={board.sprintOptions}` to `<StorySheet>`.
- `components/backlog/BacklogList.tsx`, `components/engineering/EngineeringBoard.tsx`, `components/sprints/SprintBoard.tsx`, `components/sprints/SprintPlanBoard.tsx`, `components/hygiene/OrphanTriage.tsx`, `components/pipeline/QuoteSheetEditor.tsx` — same: thread `sprints` from the page-level loader into `<StorySheet sprints={...}>`.
- For `QuoteSheetEditor` and any other page that doesn't currently load the board, add a lightweight `listSprintOptions()` to `lib/sprints.ts` (id + number + status only, cached on `sprints:all`).

### 2b. UI — filter to current/future, never past

`components/engineering/StorySheet.tsx` lines 588–624 already render a sprint `<select>`. Update:

- Build `selectableSprints = sprints.filter(s => s.status === "In Progress" || s.status === "Next")`.
- If the story is already pinned to a `Done` sprint, keep that option in the list (disabled/“· Done”) so the value renders, but new selections only come from `selectableSprints`.
- Sort: `In Progress` first, then `Next` by `number` ascending (next-up at top).
- Keep the existing save path (`setStorySprint` / single-id payload) — no mutation changes required.

### 2c. Mutation — no changes

`lib/mutations/story.ts:setStorySprint` already does the right thing.

---

## 3. Sprint Plan page (`/sprints/[id]/plan`) rebuild

### 3a. Strip money

Remove every dollar / commission UI from:

- `components/sprints/SprintPlanBoard.tsx` — drop `fmtMoney`, `COMMISSION_RATE`, the `commission` line in `EngineerRow`, and the `fmtMoney(story.invoice)` cell in `BacklogPlanRow`.
- `lib/sprint-plan.ts` — drop `committedInvoice` / `committedCommission` from `EngineerCapacity`.
- `lib/sprint-plan-types.ts` — drop those two fields from the type.

### 3b. Per-engineer per-sprint capacity (editable)

Use the existing **🟢 Sprint Capacity** Airtable table (`tbleikKz5Tt8tSc0J`):

- Fields used: `People` (link), `Sprint` (link), `total hours committed` (number) — that last field stores the editable capacity for that engineer in that sprint.
- New `lib/sprint-capacity.ts` (server-only):
  - `listSprintCapacities(sprintId): Promise<{ id, personId, capacity }[]>` — cached, tag `sprint-capacity:<sprintId>`.
- New `lib/mutations/sprint-capacity.ts` Server Action:
  - `setSprintCapacity({ sprintId, personId, capacity })` — upserts (PATCH if exists, CREATE otherwise) the SprintCapacity row, gated by `requireRole("admin","lead","editor")`, then `revalidateTag("airtable")`.
- `lib/sprint-plan.ts` now reads capacities and overlays them on the engineers list: `capacity = capacityByPerson.get(eng.id) ?? DEFAULT_CAPACITY_HOURS`.

UI: in `EngineerRow`, replace the read-only `/ 80h` with a small inline number input (admin/lead only). On blur, call `setSprintCapacity` and `router.refresh()`. Use the same pending/saving micro-pattern already in the file.

### 3c. Engineers list — Role = Engineer + Active only

`lib/sprint-plan.ts` builds `engineers` from `board.groups`. Replace that source with `board.assignablePeople` filtered further to `internalType` / role:

- Add a `role` + `status` pass: keep people where `peopleMap.get(p.id).role === "Engineer"` AND `status === "Active"`. (Confirm exact `Role` choice in Airtable — schema check shows the field exists on People.)
- Always include every qualifying engineer, even those with 0 committed stories, so capacity rows exist before any planning happens.
- Header "× engineers active" stays.

### 3d. Story pool — unassigned + assigned, Todo/In progress only

Right now the pool is "no sprint AND not in `BACKLOG_EXCLUDED`". Change to:

- **Pool = stories where `sprintIds.length === 0` AND `status ∈ {Todo, In progress}`** (drop everything else from this view; ignore Analysis Required / On Hold / Incomplete / QA / Completed / Archived). Includes orphan (no assignee) AND already-assigned stories — both appear in the pool ready to be added to this sprint.
- Each row shows: priority dot, `#id`, name, client, hours, assignee chip(s) if any. **No invoice column.**
- Sort: Urgent → Low, then by hours desc.

### 3e. Easy add-to-sprint UX

In `BacklogPlanRow`:

- If the story has no assignee → keep the current "→ {engineer first name}" chip row (clicking picks the engineer AND adds to sprint).
- If the story already has assignee(s) → show a single primary "Add to sprint" button that calls `planStory(storyId, [...sprintIds, plan.sprintId], assigneeIds)` (no assignee change). Plus a secondary "Change engineer ▾" small menu reusing the same chip row, in case planning wants to reassign.
- Keep the per-row pending state pattern.

### 3f. KPI cards on the page

Replace the existing four cards with:

- Total capacity (sum of per-engineer capacity) · `Nh`
- Committed (sum of split hours) · `Nh` · utilization %
- Free · `Nh`
- Stories ready to plan (pool size) · `Nh of unplanned work`

Remove the `GoalBar` subtext "rebalance to engineers with free capacity" → keep, but drop the dollar tone.

---

## Out of scope

- Drag-and-drop kanban (still click-based).
- Time Entries / actual hours worked.
- Editing capacity defaults globally (only per-sprint per-engineer for now).
- Changing how the engineering board, kanban board, or backlog table render money — only the sprint **plan** view drops dollars.
- Schema regeneration (`SprintCapacity` already exists in `lib/schema.ts`).

---

## Technical notes

- `setSprintCapacity` upsert pattern: first look up an existing row via `filterByFormula = AND({People}=..., {Sprint}=...)`; if found, `patchRecords`; else `createRecords`. Both wrapped with `requireRole` + `revalidateTag("airtable")` + a new tag `sprint-capacity:<sprintId>`.
- Editing capacity below current commitment is allowed — the UI just shows red/over.
- Past sprint guard for the StorySheet selector is purely client-side filtering against `status === "Done"`; no server enforcement (admins can still re-link via Airtable directly).
- Internal-only Epic Owner filter is client-side; the existing server mutation already accepts any person id, so no server-side guard is added (matches the rest of the app).
