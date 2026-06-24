
# UI Polish — Accounts & Projects

Focused on two surfaces users live in: **Account detail** (`/clients/[id]`) and **Projects** (`/pipeline` list + Quote drawer). Goal: stop everything looking the same. No business-logic changes — presentation only.

## 1. Shared visual primitives (small, reusable)

Add three pieces in `components/ui/` so the language is consistent everywhere:

- **`Section.tsx`** — titled container with a colored left rail (4px), uppercase eyebrow title, optional right-side meta, optional collapsible body. Replaces today's loose `<div>` blocks that all blend together.
- **`Field.tsx`** — label-above-value pair with stronger label/value contrast (`text-ink-faint` 10px uppercase → `text-ink-strong` 13px value), used inside Sections.
- **Table row utility** in `app/globals.css`: `.row-zebra > *:nth-child(even) { background: var(--surface-2); }` plus a `.row-hover` hover state. Applied via a single className on tbody so all list tables get it.

Also bump global contrast tokens in `globals.css`:
- `--ink-muted` from `#8B95A5` → `#A3ADBD` (current muted is hard to read on `--surface`)
- `--rule` from `#1F2735` → `#26303F` (section borders need to actually show)

## 2. Account detail page (`components/clients/ClientDetailView.tsx`)

Today it's a long flat scroll where company info, contacts, projects, invoices all look identical.

- Sticky **summary header**: company name (larger, 24px), engagement chip, partner/lead status chip, 4 inline KPIs (LTV, active projects, last invoice, days since contact). Bottom hairline gradient (same accent as PageHeader).
- Convert the body to **collapsible Sections**, each with a distinct left-rail accent color so you instantly know where you are:
  - **Company** (emerald rail) — open by default
  - **Contacts** (sky rail) — collapsed when >3 contacts; row count in header
  - **Projects** (violet rail) — open; keeps the active/completed/all tabs
  - **Invoices** (amber rail) — collapsed by default; count + outstanding total in header
  - **Activity / Log** (neutral rail) — collapsed
- Persist collapse state per-section in `localStorage` keyed by `client-detail:<sectionId>`.
- Projects + Invoices tables get zebra rows, taller row height (40px), hover highlight, and a left-edge status color stripe (3px) per row so you can scan status at a glance.

## 3. Projects page — list (`components/pipeline/QuoteTable.tsx`, `PipelineDashboard.tsx`)

- Zebra rows + hover state + 40px row height.
- Sticky table header with subtle backdrop blur so column titles stay visible while scrolling.
- Group rows by **deal stage** with a sticky group header bar (stage name + row count + subtotal). Collapsible per group, state remembered.
- Money columns get tighter mono numerics and a divider before "Committed Uninvoiced" so the three money columns (Quote Total / Invoiced / Committed Uninvoiced) read as a unit.
- Stage column becomes a pill with a left status-color dot — currently it's plain text and blends in.

## 4. Project drawer (`components/pipeline/QuoteSheetEditor.tsx`, 1.4K lines)

This is the densest screen and the biggest readability complaint. Refactor presentation only (no logic changes):

- Drawer width: 720px → 880px on ≥1280px screens.
- Replace the current run-on layout with the new **Section** primitive. Each section is collapsible with persisted state:
  - **Overview** (always open) — title, client, stage pill, owner, big money trio
  - **Description / Scope** (collapsed if >300 chars) — show a 2-line preview + "Expand" affordance with chevron
  - **Stories** (open)
  - **Financials** (open) — cost breakdown, payment terms
  - **Files & Links** (collapsed)
  - **Internal notes** (collapsed)
  - **Activity log** (collapsed)
- Sticky section nav rail on the left of the drawer (≥1280px only) with section names → clicking scrolls + expands.
- Long-text fields (Description, Scope, Notes) get a "show more / show less" toggle at ~6 lines instead of dumping the whole blob.
- Story sub-table inside the drawer gets the same zebra + hover treatment.

## 5. Verification

- `npx tsc --noEmit` clean
- `npm run build` clean
- Manual: load a client with many projects, a quote with a long description, and confirm collapsed-by-default sections + persistence work.

---

## Technical notes

- All color/spacing changes go through CSS vars in `app/globals.css` and the new `Section` primitive. No hard-coded hex values in components.
- New components are **presentational only**, no new data fetching, no schema changes, no mutation changes.
- Collapsible state uses a tiny `useLocalStorageBoolean(key, default)` hook in `lib/use-local-storage.ts`.
- Files touched (presentation only):
  - `app/globals.css` (token tweaks + zebra util)
  - `components/ui/Section.tsx` (new)
  - `components/ui/Field.tsx` (new)
  - `lib/use-local-storage.ts` (new)
  - `components/clients/ClientDetailView.tsx`
  - `components/pipeline/PipelineDashboard.tsx`
  - `components/pipeline/QuoteTable.tsx`
  - `components/pipeline/QuoteSheet.tsx` (width)
  - `components/pipeline/QuoteSheetEditor.tsx` (sectionize)
