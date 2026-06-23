# Airvues One — Blueprint Upgrade Plan (revised)

Scope: Phases 1–2 in full, Phase 3 limited to the Stories upgrade only. Built on existing stack (Next.js 14 App Router + Airtable via `lib/airtable.ts`, Server Actions in `lib/mutations/`, schema in `lib/schema.ts`). Surgical changes, no rewrites.

---

## Phase 1 — Blockers (data + nav foundation)

### 1.1 Unify Leads + Clients into Accounts
- **Airtable** (you've done this):
  - `Partner Status` on Clients — values: `Lead, Client`.
  - `Lead Status` on Clients — values: `New Lead, Discovery, Proposal Drafting, Proposal Sent, Won, Lost, On Hold`.
  - Lead-creation automation will be repointed to fire when a Lead is *started*, so every Lead exists as a Client row from day one.
- **App**:
  - Update `lib/schema.ts` Clients entry with the two new field IDs (`Lead Status`, `Partner Status`).
  - Rename `/clients` to **Accounts** in `lib/nav.ts` (label only; route stays `/clients` to avoid breaking links — or rename route + redirect, decide in build).
  - `ClientsDashboard` + `ClientSheet`: add Lead Status and Partner Status pickers; filter chips for both; search by name/contact/company; quick-jump to proposals, projects (quotes), invoices, contacts.
  - Remove `/leads` from sidebar nav (`showInSidebar: false`). Keep the page + `lib/leads.ts` for one deploy cycle as fallback, then delete.
  - Migrate any lead-only signals (intro meetings, funnel YTD/MTD) into `/clients`. Lead Status filter set to non-final values drives the funnel.

### 1.2 Pipeline → Projects
- **Airtable** (already in place):
  - Deadline field exists as `Client Delivery Due Date` on Quotes.
  - Proposal Type values are `Airtable Solutions Proposal` and `Retainer Agreement` — drop the legacy `Web Development Proposal` / `Airtable Solutions` options from `components/pipeline/types.ts`.
- **App**:
  - Rename `/pipeline` route + nav entry to `/projects`, label **Projects**. Keep Quote records as the project records (one Quote = one Project).
  - Add `Client Delivery Due Date` to `lib/schema.ts` (Quotes) and to `QuoteFields` / `QuoteDetail` as `clientDeliveryDueDate: string | null`.
  - Wire it into the signed-contract template output (need to confirm template location — open question below).
  - List ordering in `QuoteTable`: `Sent / Awaiting Approval` → `In Progress` → others → `Rejected` filtered out by default, toggle to show.
  - Sort + filter by deadline risk (overdue, ≤3d red, ≤7d yellow) based on `clientDeliveryDueDate`.

### 1.3 Navigation + UX baseline
- `lib/nav.ts`: regroup into the spec's 6 tabs — **Overview · Accounts · Projects · Stories · Proposals · Earnings**.
  - **Stories** umbrella combines current Engineering / Backlog / Sprints as sub-views.
  - **Proposals** is a new top-level surface — initially a filtered view over Quotes (Proposal Type set) until/if proposals split off; for now Projects and Proposals point to the same underlying Quotes data with different default filters.
- Only `/` (Overview) keeps dashboard widgets. Strip overview / release-notes blocks from `/accounts`, `/projects`, `/me`, `/engineering`, `/money`, etc. Operational table at the top; summary chips collapsed in a header strip.
- Hierarchy pass in `components/ui/PageHeader.tsx` + tables: stronger page titles, clearer section headers, weight contrast between labels and body, JetBrains Mono only on numerics, alternating row backgrounds on key tables.
- Persistent filters: shared `useSearchParamsFilter` hook so filter state survives cross-tab navigation (Accounts, Projects, Stories, Earnings).

---

## Phase 2 — Workflow continuity

### 2.1 In-context proposal creation
- Replace side-panel-only proposal create with anchored entry points:
  - From `/clients/[id]` → "New Proposal" routes to a full-page editor pre-linked to that account (`/clients/[id]/proposals/new`).
  - From `/projects` → "New Proposal" requires account selection first, then routes into the same editor.
- After save, redirect back to `/clients/[id]` with the new proposal highlighted in the proposal history timeline — no dead end.
- Proposal Type select stays as the two existing Airtable values (`Airtable Solutions Proposal`, `Retainer Agreement`).
- `Client Delivery Due Date` is required in the new-proposal form.

### 2.2 Project log / audit trail
- **Airtable** (table already created): `Project Log` with `Account` link → Clients. You opted out of an Actor field, so the app will not write or render Actor.
- **App**:
  - Update `lib/schema.ts` with the Project Log table + field IDs.
  - New helpers in `lib/mutations/project-log.ts`: `logEvent({ account, project?, eventType, timestamp, detail })`.
  - Event types to record: `Lead created, Discovery notes added, Proposal sent, Proposal signed, Payment received, Deadline changed, Story created, Story completed, Invoice created`.
  - Existing mutations (`lib/mutations/lead.ts`, `quote.ts`, `story.ts`, `invoice.ts`) get a `logEvent(...)` call after their successful patch.
  - Render the timeline inside `/projects/[id]` (existing `pipeline/[id]/page.tsx`) and as a collapsed section on `/clients/[id]`.

### 2.3 Deadline warnings
- `lib/pipeline.ts` (or new `lib/projects.ts`) derives `deadlineRisk` per project from `clientDeliveryDueDate`: `overdue | red (≤3d) | yellow (≤7d) | ok`.
- Surfaces: badges on project rows, a "Needs attention" saved view on `/projects`, and an Overview KPI tile.

---

## Phase 3 — Stories upgrade only

(Loom + Slack and Retainer Monthly Rollups are explicitly out of scope this round.)

- Schema audit: confirm Stories has `Assignee`, `Hours` (estimated), `Hours Worked` (actual), `Story Status`. Add fields only if absent.
- Add a computed `Progress %` derived purely from status (no time math):
  - `Todo = 0`, `In progress = 50`, `QA Review = 50`, `Completed = 100`, `On Hold = 50`, `Incomplete = 50`, `Analysis Required = 0`, `Archived = 100`.
- `StoryCard` + `StorySheet`: render the progress bar, show `actual` as the primary number with `estimated` as muted reference. Actual never mutates cost fields (display/reporting only, preserves existing `Cost`/`Invoice` rules in CLAUDE.md).
- Filters: engineer · project · status, persistent via the shared filter hook from 1.3.

---

## Technical notes (for engineers)

- **No framework swap.** Next.js 14 App Router on Vercel (per CLAUDE.md). Ignore any TanStack/Supabase scaffolding context.
- **All writes go through `lib/mutations/*` Server Actions** with `requireRole(...)` first. New mutations follow the existing try/catch `AuthzError`, `revalidateTag("airtable")`, specific-tag pattern.
- **Schema additions** are done in Airtable UI; after each change update `lib/schema.ts` with the real field IDs (no guessing).
- **New cache tags**: `accounts:all`, `projects:all`, `project-log:{projectId}`.
- **Nav single source of truth** stays `lib/nav.ts` — sidebar / mobile / home consume it; do not fork.
- **Don't delete the Leads page code** until Accounts ships; hide via `showInSidebar: false` first.

## Rollout order

1. Update `lib/schema.ts` with Partner Status, Lead Status, `Client Delivery Due Date`, and Project Log field IDs.
2. Phase 1 code: nav restructure, Accounts page (status pickers + filters), Projects rename, deadline display, proposal-type cleanup.
3. Phase 2 code: in-context proposal flow, project-log writes from existing mutations, deadline warnings.
4. Phase 3 code: Stories progress + filters.
5. Each phase ends with `npx tsc --noEmit` + `npm run build` + curl smoke of `/`, `/clients`, `/projects`, `/me`, `/engineering`, `/money` (per CLAUDE.md).

## Out of scope / explicit non-goals (this round)

- Loom on projects + Slack notify (3.2).
- RetainerMonth table + monthly rollups (3.3).
- Actor field on Project Log.
- Drag-and-drop kanban, Cmd+K, automated actual-hours → cost mutation, Time Entries logging UI.

## Open questions still worth answering before build

1. **Contract generator** — where does the signed contract get rendered today? Need the template surface to wire `Client Delivery Due Date` into it.
2. **Rejected projects** — confirm hide-by-default with a toggle (plan's current assumption) vs. collapsed "Rejected" section at the bottom.
3. **Proposals tab** — keep it as a filtered Quotes view, or wait until proposals truly split from projects?

Answer these in build mode and we wire them in as we hit each step.
