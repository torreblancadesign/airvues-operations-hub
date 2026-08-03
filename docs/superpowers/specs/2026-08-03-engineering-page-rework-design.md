# Engineering Page Rework — Design Spec

**Date:** 2026-08-03
**Status:** Approved direction, pending final user review
**Scope:** `/engineering` only. Incremental rework of the committed page — no new data sources, no changes to `lib/engineering.ts` queries, mutations, or the StorySheet drawer.

## Problem

The page has the right ingredients but poor placement:

- The Capacity Planning panel and the engineer sections are two stacked full-width lists of the *same people with the same numbers*. Story content starts ~3 screens down.
- 7 of 11 capacity rows are all zeros (engineers with no active work).
- Dead metrics ("Worked 0h" in 3 places, "Over budget 0", card footer "0h worked") read as breakage — Time Entries were never adopted, so these are always zero.
- "Unassigned" is represented 5 ways (KPI card, red banner, dropdown option, checkbox, section).
- The filter bar sits below two banners, detached from the list it filters, and is not sticky.
- Story cards carry ~11 data points each; the 3-column gallery makes stories hard to scan and compare.

## Design — five moves + story table

### 1. One roster (merge CapacityPanel + engineer sections)

Single list, one entry per engineer. The former capacity row becomes the section header:

- **Header row:** status dot · name · role/type · assigned-hours bar (relative to max across engineers) · counts: `N doing` (In progress) · `N todo` · `N QA` · `Nh assigned` · expand/collapse affordance. "View scorecard →" stays in the expanded state.
- **Sort:** Unassigned pinned first, then engineers by `inProgressCount` desc, then `activeHoursAssigned` desc.
- **Engineers with zero active stories** collapse into ONE trailing row: "▸ N engineers free — name, name, …" which expands to their (empty-state) entries.
- `CapacityPanel.tsx` is deleted; its bar/labels merge into the new header inside `EngineeringBoard.tsx`.

### 2. Remove dead numbers

- Delete all "Worked hrs / Worked 0h / · 0%" displays (board header columns, capacity rows, card footer).
- Delete the "Over budget" KPI card.
- `hoursWorked` stays in the data layer and StorySheet (it is correct there when present); only the always-zero aggregates leave the board UI.

### 3. One home for Unassigned

- KPI card "Unassigned" stays clickable (toggles the orphan-only view).
- Unassigned renders as the pinned first roster row (red accent), with "Triage →" link to `/hygiene/orphans` in its header.
- Removed: red banner, "Orphan only" checkbox, "Unassigned (orphan)" option in the engineer dropdown.

### 4. Sticky filter bar directly above the roster

- Order becomes: PageHeader → KPI strip → filter bar → roster. Banners as separate blocks are removed (QA bottleneck becomes a KPI, see below).
- Sticky under the TopBar (correct top offset so it doesn't glitch like the redo did), `z` above roster, subtle backdrop.
- Controls: search · Status ▾ · Engineer ▾ · Client ▾ · Sprint ▾ · **Priority ▾ (new)** · Clear. URL-sync via existing `useSearchParamsFilter` (add `priority` key).
- "Showing X of Y stories" count stays.

### 5. Stories as a table (replaces the card gallery)

Inside each expanded engineer row, a compact table — one story per row:

| Col | Content |
| --- | --- |
| Status | existing status chip (same tones) |
| # | story number, mono |
| Priority | colored dot + label on ≥lg |
| Name | primary text, truncates, min-w-0 |
| Client | first client name, truncates |
| Sprint | `S24` style, muted |
| Est | scoped hours `5h`, right-aligned, mono |

- Row click → StorySheet drawer (unchanged). Selected row highlighted.
- Pay/payout chips, quote, description, progress: **drawer only** (removed from list view).
- `<lg` viewports: table degrades to stacked two-line rows (status+name / client+est).
- `StoryCard.tsx` is no longer used by the board but **stays** — `components/me/PersonScorecard.tsx` imports it.

### KPI strip (adjusted)

4 cards: **Active stories** · **In progress now** (new — count of stories with status "In progress") · **Unassigned** (clickable, as today) · **QA queue** (new — clickable, filters to status=qa; replaces the amber bottleneck banner; amber tone when > 0).

## Components after the rework

- `EngineeringBoard.tsx` — KPI strip, sticky FilterBar, unified roster (header rows + expandable story tables), StorySheet wiring. Roster row and story table may split into small files (`RosterRow.tsx`, `StoryTable.tsx`) if the board grows past ~300 lines.
- `FilterBar.tsx` — + Priority select, − orphan checkbox; sticky styling handled by parent wrapper.
- `CapacityPanel.tsx` — deleted.
- `StoryCard.tsx` — removed from board imports only; file remains for `/me`.
- `types.ts` — `Filter` gains `priority: string | null`.
- No changes: `lib/engineering.ts` (data already includes everything needed), `StorySheet.tsx`, mutations, page shell / `assertCanAccess`.

## Error handling & testing

- Error state on the page is unchanged (existing try/catch on `getEngineeringBoard`).
- Verify: `npx tsc --noEmit` → `npm run build` → click-through on :3002 (filters incl. URL params, expand/collapse, orphan toggle, StorySheet open/edit gating, mobile width).

## Out of scope (explicitly)

- Availability/capacity math changes (Sprint Capacity table integration) — future iteration.
- Drag-and-drop, CSV export, new routes, data-layer changes.
