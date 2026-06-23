
# Remaining work — Airvues One upgrade

Schema is now wired (`Lead Status`, `Partner Status` on People; `Client Delivery Due Date` on Quotes; new `ProjectLog` table). Nav restructure and story-progress logic already landed. Below is what's left.

## Phase 1 — finish data layer + UI

### 1.1 Accounts (Clients page) — status pickers & filters
- Extend `lib/clients.ts` to read `Lead Status` and `Partner Status` and expose them on the `Client` type.
- `components/clients/ClientsDashboard.tsx`: add filter chips for Partner Status (Lead/Client/All) and Lead Status (7 values + All), plus a search field that hits name/email/company. Persist via `useSearchParamsFilter` (new shared hook in `lib/use-search-params-filter.ts`).
- `components/clients/ClientSheet.tsx` (and `InlineField`): add inline pickers for both statuses, writing through a new `lib/mutations/client.ts` (`updateClientStatuses`) that calls `requireRole("admin","lead")`, patches the People table, and `revalidateTag("airtable")` + `accounts:all`.
- Migrate lead-only widgets (intro meetings, funnel) onto `/clients`, driven by `Lead Status`. Hide `/leads` from sidebar (`showInSidebar:false`) — keep page code for one deploy cycle.

### 1.2 Pipeline → Projects
- Rename route: `app/(app)/pipeline/` → `app/(app)/projects/` (keep `[id]` subroute). Add a redirect from `/pipeline` → `/projects` in `next.config.js`.
- Update nav label to **Projects** in `lib/nav.ts`; update `PageHeader` copy.
- Extend `lib/pipeline.ts` (rename file to `lib/projects.ts`, re-export old names for one deploy):
  - Read `Client Delivery Due Date` (`fldMC7hyVxocpwFUC`) into `QuoteFields` / `QuoteDetail` as `clientDeliveryDueDate: string | null`.
  - Compute `deadlineRisk: "ok" | "yellow" | "red" | "overdue"` from due date vs today.
- `components/pipeline/QuoteTable.tsx`: new Deadline column with risk-colored badge; default sort puts `Sent / Awaiting Approval` → `In Progress` first; **rejected hidden by default** with a "Show rejected" toggle (per blueprint default).
- `components/pipeline/FilterBar.tsx`: wire `deadlineRisk` filter chips (All / Needs attention / Overdue / ≤3d / ≤7d) and `showRejected` toggle, already in `types.ts`.
- `QuoteSheetEditor.tsx`: editable date input for Client Delivery Due Date; write through existing `lib/mutations/quote.ts` (add field to patch).
- Wire `clientDeliveryDueDate` into whichever signed-contract render surface exists — needs confirmation (see open question).

## Phase 2 — workflow continuity

### 2.1 In-context proposal creation
- New full-page editor route `app/(app)/clients/[id]/proposals/new/page.tsx` reusing `QuoteSheetEditor` in "create" mode. Pre-link `Prepared for` to the account.
- From `/projects` (formerly pipeline) "New Proposal" button: require account selection (lightweight account picker modal) → redirect into `/clients/[accountId]/proposals/new`.
- After save, redirect to `/clients/[id]?highlight=<quoteId>`; `ClientDetailView` reads `?highlight` and scrolls/highlights that row in the proposal history.
- Proposal Type select is already cleaned up to the two Airtable values.

### 2.2 Project Log / audit trail
- New `lib/project-log-types.ts` (client-safe) and `lib/project-log.ts` (server reader, cached, tag `project-log:{projectId}`).
- New `lib/mutations/project-log.ts` exposing `logEvent({ accountId, projectId?, eventType, detail, timestamp? })`. Uses `createRecords(Tables.ProjectLog.id, [...])` with field IDs. No Actor field (per spec).
- Add `logEvent(...)` after successful patch in:
  - `lib/mutations/quote.ts` — `Proposal sent`, `Proposal signed`, `Deadline changed`, `Project status changed`.
  - `lib/mutations/story.ts` — `Story created`, `Story completed`.
  - `lib/mutations/invoice.ts` — `Invoice created`, `Payment received`.
  - `lib/mutations/lead.ts` / new client mutation — `Lead created`, `Partner status → Client`.
- Render timeline component `components/projects/ProjectLogTimeline.tsx` on `/projects/[id]` and a collapsed version on `/clients/[id]`.

### 2.3 Deadline warnings surface
- Overview KPI tile on home: "Projects needing attention" count.
- Saved view on `/projects`: filter preset `deadlineRisk=needs-attention`.
- Row-level deadline badge (Phase 1.2).

## Phase 3 — Stories upgrade (only remaining bits)
- `StoryCard` already updated with status-driven Progress %. Apply same to `StorySheet` header + `BacklogRow`.
- Show `actual` (Hours Worked) as the primary number, `estimated` (Hours) as muted reference, across StoryCard, StorySheet, BacklogRow. No cost mutation.
- Persistent filter state on `/engineering`, `/backlog`, `/sprints` via the shared `useSearchParamsFilter` hook (engineer · project · status).

## Technical notes
- All writes through `lib/mutations/*` with `requireRole(...)`; existing try/catch + `revalidateTag` pattern preserved.
- New cache tags: `accounts:all`, `projects:all`, `project-log:{projectId}`.
- Single nav source `lib/nav.ts` — sidebar/mobile/home consume it.
- `next.config.js` permanent redirect `/pipeline` → `/projects` (and `/pipeline/:id` → `/projects/:id`) so old links don't 404.
- Verify each phase with `npx tsc --noEmit` + `npm run build` + curl smoke (`/`, `/clients`, `/projects`, `/engineering`, `/money`).

## Rollout order
1. Shared `useSearchParamsFilter` hook + `lib/projects.ts` extensions (deadline fields + risk).
2. Phase 1.2 Projects rename + deadline UI.
3. Phase 1.1 Accounts status pickers + filters + `lib/mutations/client.ts`.
4. Phase 2.2 Project Log (table reader, mutation helper, write hooks in existing mutations, timeline component).
5. Phase 2.1 In-context proposal flow.
6. Phase 2.3 Deadline KPI tile + needs-attention preset.
7. Phase 3 Stories actual/estimated display + persistent filters.

## Open questions to answer in build mode
1. **Contract generator** — where does the signed contract render today (PandaDoc? Airtable Page Designer button `fldvBUKNOnYc8EI7N`? a Next.js route?) so we know where to inject `Client Delivery Due Date`.
2. **Proposals tab** — keep as a filtered view of Quotes (current plan), or defer until proposals split from projects? If keep, what default filter — all non-Draft, or just `Sent. Awaiting Approval.`?

## Out of scope (unchanged)
- Loom on projects + Slack notify (3.2).
- RetainerMonth + monthly rollups (3.3).
- Actor field on Project Log.
- Drag-and-drop kanban, Cmd+K, automated actual→cost, Time Entries UI.

