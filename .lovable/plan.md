## Goal
Add a Leads icon and organize the sidebar into logical category groups so the 12 routes become scannable at a glance.

## 1. Leads icon
Add a "users-with-plus / inbox" style icon to both `components/Sidebar.tsx` and `components/MobileNav.tsx` icon maps, keyed to `/leads`. Proposed: a magnet/inbox-arrow glyph (people pipeline). Final pick: **inbox-down arrow** (matches "inbound demand" framing of the page) — consistent stroke weight with existing 14px lucide-style SVGs already inlined in the file.

## 2. Sidebar grouping

Introduce a `group` field on `NavItem` in `lib/nav.ts` (single source of truth — Sidebar, MobileNav, and the Home Jump grid all consume it). Groups render as small uppercase labels (`text-[10px] text-ink-faint tracking-wider`) above each cluster, matching the existing "Dev Preview / Live" footer label styling — no new visual language introduced.

Proposed grouping (4 buckets, ordered by daily-use frequency):

```text
OVERVIEW
  Home
  My Scorecard

REVENUE
  Leads
  Sales Pipeline
  Earnings
  Clients

DELIVERY
  Engineering
  Backlog
  Sprints

OPERATIONS
  Team
  Stack
  Hygiene
```

Rationale:
- **Overview** = personal + firm landing (where you start the day).
- **Revenue** = full money funnel left→right: lead in → quote → invoice → client relationship.
- **Delivery** = execution surface for engineers/leads.
- **Operations** = back-office (people, tooling, data quality) — visited least often, sits at bottom.

## 3. Scope of changes
- `lib/nav.ts` — add `group: "overview" | "revenue" | "delivery" | "operations"` to each item; export a `NAV_GROUPS` ordered array with display labels.
- `components/SidebarNav.tsx` — render items grouped, with a small label row between groups. Active-route + emerald accent logic unchanged.
- `components/MobileNav.tsx` — same grouping in the drawer; add Leads icon entry.
- `components/Sidebar.tsx` — add Leads icon entry to the `ICONS` map.
- Home Jump grid (`app/(app)/page.tsx` / `HomeJumpCard`) — out of scope unless you want grouping there too (let me know).

## Technical details
- No data layer changes. No auth changes. Pure presentation + nav metadata.
- Active-state, mobile drawer behavior, and "showInSidebar / showOnHome" flags preserved.
- Verification: `npx tsc --noEmit` + visual check of sidebar at desktop and mobile widths.

## Open question
Want the same category grouping applied to the Home page Jump-To cards, or keep that grid flat?