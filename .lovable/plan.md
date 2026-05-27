
## Scope

Two high-yield additions:
1. **Cmd+K command palette** — global search across Clients, Stories, Quotes, Invoices, People, plus nav routes.
2. **Activity feed (last 24h)** — surfaces recent mutations across the firm on the home page.

---

## 1. Cmd+K command palette

### UX
- Trigger: `⌘K` (mac) / `Ctrl+K` anywhere in the app + clickable search affordance in `TopBar` (left of Gmail widget) showing `Search  ⌘K`.
- Modal: centered, ~640px wide, dark surface, single input + grouped result list (Routes · Clients · Stories · Quotes · Invoices · People).
- Keyboard-first: ↑/↓ navigate, ↵ open, Esc close. Mouse works too.
- Each result has type chip, title, secondary line (e.g. story → company · status; invoice → number · amount · status).
- Selecting a record opens its existing detail page or drawer route (e.g. `/clients?open=<recId>`, `/backlog?open=<recId>` — we'll use existing sheet open-by-id where supported, otherwise navigate to the parent page).

### Data
- New file `lib/search-index.ts` (server-only): one cached function `getSearchIndex()` that returns a flat array of `SearchItem`:
  ```ts
  type SearchItem = {
    id: string; type: "client" | "story" | "quote" | "invoice" | "person" | "route";
    title: string; subtitle?: string; href: string; keywords: string;
  }
  ```
- Pulls minimal fields (id, name/title, status, company link) from `Companies`, `Stories`, `Quotes`, `Invoices`, `People` via `listRecordsCached` with `["search-index"]` tag. Routes come from `lib/nav.ts`.
- Cached 5 min (existing `unstable_cache` default). Payload kept lean (~few hundred KB max; estimate ~3-5k records).

### API
- New route `app/api/search/route.ts` (GET) returning the full index JSON for the signed-in user. Gate with `getAppSession()`; no role filter for v1 (everyone who can log in can search everything they already have page access to).
- Client fetches once on first palette open, caches in memory for the session, revalidates on focus after 5 min.

### Components
- `components/search/CommandPalette.tsx` (client) — modal, input, fuzzy match (lightweight: lowercase substring + token scoring; no new dep). Uses `cmdk` package for accessible primitive — small, well-maintained, ~6KB. `bun add cmdk`.
- `components/search/CommandPaletteProvider.tsx` (client) — global keydown listener + portal. Mount once in `app/(app)/layout.tsx` alongside `TopBar`.
- `TopBar` gets a `SearchTrigger` button that opens the palette.

### Out of scope
- No server-side fuzzy ranking (client-side is fine at this scale).
- No recency boost / "recently visited" section (can add later).
- No write actions from palette (v1 is navigation/search only).

---

## 2. Activity feed (last 24h)

### UX
- New section on home (`app/(app)/page.tsx`) titled **"Last 24 hours"**, placed between *Your day* and *The board*.
- Compact list, ~8-12 rows max with a "view more" link if we add a dedicated page later.
- Each row: timestamp (relative, e.g. "2h ago"), actor name, action verb, target link.
  - Examples:
    - "Hayden moved *Story X* → QA Review"
    - "Invoice #1042 marked Paid · $4,800"
    - "Quote for *Acme Co* → Won"
    - "Sprint *2026-W22* closed"
    - "New story *Foo* created on *Acme Co*"

### Data
- New file `lib/activity.ts` (server-only). One function `getRecentActivity(limit = 12)`.
- v1 strategy: derive activity from Airtable `Last Modified Time` + `Last Modified By` fields where available, plus `Created` timestamps. Tables surveyed:
  - Stories — status changes (use `Last Modified` + current `Story Status`)
  - Invoices — `Status` = Paid in last 24h (use `Paid Date` or `Last Modified`)
  - Quotes — `Status` = Won/Lost in last 24h
  - Sprints — `Sprint Status` = Done in last 24h
  - Stories — created in last 24h
- Pulls each table with `filterByFormula` `IS_AFTER(LAST_MODIFIED_TIME(), DATEADD(NOW(), -1, 'days'))` (or `{Created}` for new-record events), small `maxRecords` cap per table (e.g. 25), then merges + sorts + trims to `limit`.
- Cached 2 min, tag `["activity"]`. Mutations already call `revalidateTag("airtable")` which busts this.
- We won't have true "who did what" for every event (Airtable's `Last Modified By` only fires when edited through Airtable UI or when we explicitly write it). For v1: show actor when `Last Modified By` is present, otherwise omit and show only the event.

### Types & component
- `lib/activity-types.ts`:
  ```ts
  type ActivityEvent = {
    id: string;
    at: string; // ISO
    kind: "story_status" | "story_created" | "invoice_paid" | "quote_closed" | "sprint_done";
    actor?: { name: string } | null;
    text: string; // pre-rendered sentence
    href: string;
  };
  ```
- `components/home/ActivityFeed.tsx` (server-safe presentation, plain list + relative time formatter).
- Empty state: "Quiet last 24h — nothing changed."
- Error state: red bordered card identical to other home sections.

### Out of scope (deferred)
- Dedicated `/activity` page with pagination + filters.
- Mutation audit log table in Airtable (separate higher-effort task — recommendation #13).
- Realtime updates (polling/SSE). v1 refreshes on home reload + 2-min cache.

---

## File changes

**New:**
- `lib/search-index.ts`
- `lib/activity.ts` + `lib/activity-types.ts`
- `app/api/search/route.ts`
- `components/search/CommandPalette.tsx`
- `components/search/CommandPaletteProvider.tsx`
- `components/search/SearchTrigger.tsx`
- `components/home/ActivityFeed.tsx`

**Edited:**
- `app/(app)/layout.tsx` — mount `<CommandPaletteProvider />`.
- `components/header/TopBar.tsx` — add `<SearchTrigger />` on the left of the widget cluster.
- `app/(app)/page.tsx` — fetch `getRecentActivity()` in the existing `Promise.all`, render `<ActivityFeed />` section.

**Deps:**
- `bun add cmdk` (small, accessible command-menu primitive used by Linear/Vercel).

---

## Verification
- `npx tsc --noEmit` → 0 errors
- `npm run build` → 0 errors, bundle delta sane
- Manual: ⌘K opens, type "acm" → Acme company shows; ↵ navigates. Reload home → activity section renders ≤12 items, sorted desc.
- Curl `/api/search` while signed out → 401; signed in → JSON payload.

## Out of scope (separate plans later)
- Recommendations #2 (Sprint pulse strip), #4 (CSV export), #5 (client health), #6 (cash forecast), #7 (morning digest), and the rest of the list.
