# Airvues Ops Dashboard — Design Spec

> **Status:** Historical design doc (2026-04-24). For current state of the codebase, see [`/CLAUDE.md`](../../CLAUDE.md) and [`/HANDOVER.md`](../../HANDOVER.md). This spec captures the original v1 design — most of it has shipped, with deviations documented in the auth + handover docs.
>
> **Date:** 2026-04-24
> **Deploy target:** Vercel (`airvues-ops.vercel.app`)

---

## 1. Problem

Airvues is run out of an Airtable base of 32 tables and ~700 fields. The data is rich but the surface for working with it is Airtable views, which:

- Don't role-gate (a contractor sees the same UI as a founder).
- Don't aggregate KPIs the way Lee tracks the firm's health (revenue vs plan, sprint delivery, MRR, escalations).
- Don't summarize "what changed since yesterday."
- Aren't pleasant to use on a phone.
- Cost ~$20/seat/month per collaborator and require Airtable-shaped thinking from non-technical users.

Lee needs a single internal product — `ops.airvues.com` — that is the daily home for running the firm: KPIs, money in/out, pipeline at a glance, the team, the software stack. Phase 2 turns it into the operational tool the team uses (time entry, standups, story status). MVP1 is the founder's home with read across all seven sections and write enabled on a deliberately scoped subset (see §3).

## 2. Goals & non-goals

### Goals
- A single page Lee opens every morning that answers "is the firm on plan?" in under 5 seconds.
- Read/write CRUD on Airvues data (clients, team, invoices, quotes, internal stack) without opening Airtable.
- Per-person login with role-based gating (founder admin / editor / viewer).
- Mobile usable (iPhone primary; founders open it between meetings).
- Foundation for Phase 2 ops workflows (time entry, standups, kanban) — so the data + auth layer pays for itself when those ship.

### Non-goals (MVP1)
- No client-facing portal. Internal only.
- No payments / invoice creation flows that bypass Stripe. Existing Stripe-via-Airtable flow is unchanged.
- No replacement of Airtable as the database. Airtable remains source of truth for client/financial/agile data.
- No PandaDoc, no signing flows, no PDF generation. Existing scripts remain.
- No analytics warehouse. KPIs are computed live from Airtable on each page load, with a 5-minute server-side cache.
- No Slack / Gmail integrations. Future phase.

## 3. Audience & roles

| Role | Who | Sees | Can edit |
|---|---|---|---|
| **Admin** | Lee, Enrique | Everything including financials, comp, equity, app user management | Everything writable in MVP1 (see below) |
| **Editor** | Shania, Jose, Bracho (post-May 1 FTEs) | Clients, projects, stories, time entries; financial summaries (no comp/equity); pipeline | Clients (engagement freq, contract type, status), pipeline stage moves |
| **Viewer** | Cody (L1), future hires during onboarding | KPI summaries (no $ amounts), team list, own stories, own time entries | Nothing in MVP1; own time entries in Phase 2 |

Roles are stored on the App Users record (see §6). Permission checks happen server-side on every API route and inside `getServerSession()` in pages — never trusted from client.

### MVP1 writable surface (explicit)

| Writable | Surface | Roles |
|---|---|---|
| `Companies` engagement freq, contract type, hourly rate, has-NDA, logo | `/clients/[id]` | admin, editor |
| `Form Submissions` Feasibility Status (pipeline stage moves only) | `/pipeline` (drag-to-move) | admin, editor |
| `Subscriptions` (all fields incl. new Category/Health/URL/Owner) | `/stack` | admin |
| App Users allowlist (env var; admin UI updates trigger Vercel env redeploy in v0) | `/settings/users` | admin |

**Read-only in MVP1:** Quotes, Invoices, Stories, Sprints, Team Task Payments, People, all financial mutations. These remain edited in Airtable directly. Phase 2 introduces write paths for time entries, stories, and quote-status changes.

## 4. Information architecture

### Routes

| Route | Purpose | MVP1? |
|---|---|---|
| `/` | Founder home — KPIs · Money · Pipeline (compact) · Team (compact) · Stack | ✅ |
| `/login` | Email magic-link sign-in | ✅ |
| `/pipeline` | Full kanban: Scoping → Proposal Sent → Negotiating → Awaiting Payment → Won → Lost | ✅ |
| `/team` | Full team directory (filters via URL search params; expected <50 rows so single page) | ✅ |
| `/clients` | Full client/company list (filters via URL search params; default page size 50; cursor pagination via Airtable offset token) | ✅ |
| `/clients/[id]` | Client detail: contacts, quotes, invoices, projects, history | ✅ |
| `/money` | Full financial view: P&L, revenue by client, all invoices, ageing report (filters via URL search params; default page size 100; cursor pagination via Airtable offset token) | ✅ |
| `/stack` | Software inventory + renewals calendar | ✅ |
| `/settings` | App users (admin only), profile, integrations | ✅ |
| `/time` | Time entry against stories | Phase 2 |
| `/standups` | Daily team status posts | Phase 2 |
| `/stories` | Kanban board for active sprint stories | Phase 2 |

### Founder home sections (in order)

1. **Masthead** — brand, ticker (MRR/AR/sprints/quotes hidden <1200px), updated indicator, top nav. (The Founder/Eng/Client view-simulator toggle visible in the mockup is **Phase 2** — useful for admins QA-ing role views, not on the MVP1 cut.)
2. **Greeting + standfirst** — `Good {time-of-day}, {name}` with data-driven subtitle (`N measures · N clients · N teammates`).
3. **"Since yesterday" change strip** — 3-5 items: invoices paid, new leads, status changes, overdue alerts. Driven by Airtable `Last Modified` queries scoped to last 24h on Quotes/Invoices/Form Submissions/Stories.
4. **§ Key indicators** — 7-tile KPI grid. Hero tile (YTD revenue) spans 2×2; six secondary tiles flow around it.
5. **§ Money moving** — two panels: Top revenue clients YTD · Receivables ageing.
6. **§ Pipeline in flight** — 4-lane compact widget; "Open pipeline →" links to `/pipeline`.
7. **§ The team** — two panels: Active team · Login users (admin-only panel, gated server-side).
8. **§ The stack** — flat list, sourced from Subscriptions table (see §6a), shows total cost + renewals.
9. **Footer** — legal/EIN/address, no editorial colophon.

## 5. Tech stack

- **Framework:** Next.js 14 App Router (RSC by default; client components only where interaction requires)
- **Language:** TypeScript strict
- **Styling:** Tailwind CSS + shadcn/ui (tables, dialogs, forms, dropdowns)
- **Auth:** NextAuth v5 with **Google provider**, restricted to `@airvues.com` Workspace via the OAuth `hd` parameter (was: Email magic-link via Resend; revised 2026-04-26 by Lee for tighter identity tied to existing Workspace)
- **Data:** Airtable JS SDK (`airtable` npm) — server-only; never bundled to client
- **Validation:** Zod for input shapes on all mutation routes
- **Deployment:** Vercel · Edge runtime where possible · ISR/revalidate on read-heavy routes
- **Observability:** Vercel Analytics + a thin `console.error → Slack webhook` for production errors
- **Fonts:** Inter (body), Instrument Serif (display H1/H2 only), JetBrains Mono (numerics) — all Google Fonts
- **State on client:** Server actions for mutations; SWR or React Query for client-side cache invalidation on the few interactive widgets

### Why this stack
- Lee already runs Next.js 14 + Tailwind + Vercel via `life-context-web`. Pattern is proven, deploy is muscle memory.
- shadcn/ui gives accessible, composable primitives that match the brand without dragging in a heavy component library.
- NextAuth magic links remove password management and tie identity to email — the same email Airtable already uses.
- Server-only Airtable client keeps the API token out of the browser bundle (the GBDB security incident demonstrated why this matters; see `.memory/gbdb-security-key-exposure.md`).

### Repo structure

```
airvues-ops/
├── app/
│   ├── (auth)/login/
│   ├── (app)/
│   │   ├── page.tsx              # Founder home
│   │   ├── pipeline/
│   │   ├── team/
│   │   ├── clients/[id]/
│   │   ├── money/
│   │   ├── stack/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── kpis/route.ts          # Aggregations
│   │   └── airtable/[...]/route.ts
│   └── layout.tsx
├── components/
│   ├── kpi/
│   ├── money/
│   ├── pipeline/
│   ├── team/
│   ├── stack/
│   └── ui/                        # shadcn primitives
├── lib/
│   ├── airtable.ts                # Server-only client
│   ├── auth.ts                    # NextAuth config + permission helpers
│   ├── schema.ts                  # Field-ID map + Zod input shapes (CI-validated)
│   ├── kpi/                       # Per-metric calculators
│   └── activity.ts                # "Since yesterday" snapshot + diff via Vercel KV
├── docs/specs/                    # Design spec lives here
└── mockups/                       # Static design mockups (this folder)
```

## 6. Data model

> Live schema verified against base `app4vhhWMbRFOloOU` on 2026-04-24. The base has **32 tables** (not 30 as `Airvues/CLAUDE.md` states — new since: Leads, Internal Commission Tracker, Document Templates, Proposal Philosophy Airvues). Field IDs below are real and current.

### 6a. Airtable mapping — by section

#### KPI tiles

| KPI | Table | Field(s) | Computation |
|---|---|---|---|
| **YTD revenue** | Invoices `tblBrtvazPOkXrB80` | `Invoice Amount` `fldjH62YX2hE2ZzKd` (currency), `Date` `fldoUM33V6ol28rPy`, `Invoice Status` `fldQTgMQ7RfXDzStJ` | `SUM(Invoice Amount)` WHERE `Status='paid'` AND `Date >= YEAR_START` |
| **MRR** | Invoices | `Invoice Type` `fld04kdnJ7Eu85f9f` (One-time / Recurring / Payment Plan), `Invoice Amount` `fldjH62YX2hE2ZzKd`, `Invoice Status` `fldQTgMQ7RfXDzStJ` | `SUM(Invoice Amount)` WHERE `Type='Recurring'` AND `Status='paid'` AND `Date` in current calendar month. Validation: cross-check count vs Companies where `Contract Type='Membership'` AND `Engagement Frequency='Active'`; >10% drift renders a banner on `/money` |
| **Sprint delivery** | Stories `tblgd7iKw2KdPBkn2` + Sprints `tblixAL658VYnMKOz` | `Stories.Story Status` (`fldTNsiYuGhCVx7Vy` — values: Todo, In progress, QA Review, Completed, On Hold, Incomplete, Analysis Required, Archived), `Stories.📆Sprints` (`fld4M1RwkvhsPlnuj` link), `Sprints.Sprint Status` (`fldR2ssCnqVKFPePZ` — In Progress / Done / Next) | For last 4 `Sprint Status='Done'` sprints: `COUNT(stories where Story Status='Completed') / COUNT(all stories in sprint)` |
| **Escalations (current month)** | Client Feedback `tbl4GlNscZUI3XXwU` | `Overall Review` (`fldoaqHFvhedHfRd6`, rating max 5) | **Proxy:** `COUNT(Client Feedback where Overall Review <= 2 AND createdTime in current month)`. Real field doesn't exist — see §10 #1 for Phase 2 schema add |
| **On retainer %** | Companies `tblQ3hxcIEUQPLN6f` | `Contract Type` (`fldZ0xEBPUhbDQAow` — Lump Sum / Hourly / Membership), `Engagement Frequency` (`fldUJ3OQGsBrIqsoO` — Active / Occasional / Iddle / Lost / New / Archived) | `COUNT(Membership AND Active) / COUNT(Active)` |
| **Renewal rate (TTM)** | Companies + Invoices | `Companies.Engagement Frequency`, `Invoices.Retainer` (`tblBrtvazPOkXrB80` self-link), `Invoices.Retainer Individual Invoices`, `Invoices.Date`, `Invoices.Retainer/Payment Plan Count of Payment` | Derived calc in `lib/kpi/renewal.ts`: For each Membership company with first invoice 12-13 mo ago, did they have an invoice in the trailing 12 mo? Cohort renewal % |
| **CSAT** | Client Feedback | `Overall Review` rating (1-5) | `AVG(Overall Review)` over last 90 days. Display as `X.X / 5` |

#### Money panels

| Panel | Source | Logic |
|---|---|---|
| **Top revenue clients YTD** | Invoices grouped via `Invoice Payer` (`fldZYLy6CKx14suH0` link → People → Company) OR via `Form Submissions (from Quotes)` rollup chain → Company | `SUM(Invoice Amount where paid AND Date >= YEAR_START) GROUP BY company`. Top 8 + "+N more" muted row |
| **Receivables ageing** | Invoices | WHERE `Invoice Status IN ('open','sent','past due','failed')` AND `Invoice Amount > 0`. Bucket by days since `Date`. Total row at bottom |

`Invoice Status` taxonomy verified live: `open / paid / past due / failed / unsent / sent / Canceled / Refunded / void / subscribed / send subscription link`. The latter two are Stripe subscription markers — exclude from receivables.

#### Pipeline (verified — mockup lane names changed to match real workflow)

`Form Submissions.Feasibility Status` (`fldIwOPnPxwBFmmQs` — verified 12 distinct stages live, NOT 8). Mapping to 4 home lanes:

| Home lane | Includes Feasibility Status values |
|---|---|
| **Scoping** | Pending Dev Estimate · Pending Dev Assignment · Estimates Ready · Consultation Offered |
| **Awaiting reply** | More Information Needed · Awaiting Response |
| **Quote out** | Quote/Invoice Sent, Awaiting Initial Payment |
| **In delivery** | Yes – Ready to Proceed |

Excluded from pipeline view (terminal states): `Ready to Close Project · Project Completed · Unresponsive - Possible Lost Lead · Graveyard 👻`

> **Mockup correction**: lane names in `founder-home-v2.html` say "Proposal Sent / Negotiating / Awaiting Payment" — these don't exist in the real workflow. v2.2 of the mockup must rename to "Awaiting Reply / Quote Out / In Delivery". The "Negotiating" lane disappears (no such Airvues stage); the merged "Quote/Invoice Sent, Awaiting Initial Payment" stage covers what mockup called Proposal Sent + Awaiting Payment.

> **Leads table** (`tblpOwt2GB1YE2bm3`, 23f) has its own `Status` (New Lead / Needs Review / In Proposal Stage / Sold / Not Sold). It appears to be a parallel lighter intake captured via a separate Fillout form, not the canonical pipeline. **Action:** the dashboard ignores Leads in MVP1; if Lee wants to consolidate, that's a separate cleanup project.

#### Team & people

| Section | Source | Filter |
|---|---|---|
| **Active team** | People `tbl9wvZY9M7Y7hcf1` | `Type IN ('Internal','Internal team member')` AND `Status='Active'` |
| Fields shown | `First Name`, `Last Name`, `Role`, `Internal Type` (Employee / Contractor), `Status`, `Comp Type` (Hourly / Monthly / Per-task / Equity), `Comp Amount` (admin only), `Equity Percentage` (admin only), `Reporting Manager` |
| **Login users / access** | NextAuth — see §6b | Admin only |

#### Clients/companies

| Section | Source | Logic |
|---|---|---|
| `/clients` | Companies | Filter out `Engagement Frequency='Archived'`. Show `Name`, `Engagement Frequency`, `Contract Type`, `Hourly Rate`, `Has NDA?`, primary contact (rolled up from `Client List (Employees)`), YTD revenue (rolled up from Invoices via Form Submissions chain) |
| `/clients/[id]` | Companies + linked records | Detail page: contacts (People), quotes, invoices, products, form submissions history |

#### Stack (Subscriptions table)

| Section | Source | Logic |
|---|---|---|
| `/` (compact) and `/stack` | Subscriptions `tblZnJdKLwgj5GMOb` | All rows. Computed: total monthly cost = `SUM(Amount)` where `Type='Monthly'` + `SUM(Amount)/12` where `Type='Yearly'` |
| Existing fields | `Name`, `Amount` (currency), `Source` (Business Checking / Business Credit Card), `Type` (Monthly / Yearly), `Start Date`, `End Date` | |
| **Net-new fields needed (admin to add — see §6c)** | `Category` (singleSelect), `Health` (singleSelect), `URL` (url), `Owner` (collaborator) | |

> **Activity / "Since yesterday" feed** — sources detailed in §6d.

### 6b. Non-Airtable data sources

| Data | Where | Why |
|---|---|---|
| **App Users / Auth identity** | NextAuth Email provider; v0 backed by env-var JSON allowlist; v1+ upgrades to Vercel Postgres adapter | Auth identity ≠ Airtable People. Email is the join key back to `People.Primary Email` when needed (e.g., to render "current user's stories"). |
| **"Since yesterday" snapshot** | Vercel KV (Redis) — hourly cron writes a snapshot of each tracked field; diff against current = activity feed | No native Airtable change-feed without webhooks. Hourly snapshot + diff is the simplest reliable source. |
| **KPI cache** | Next.js `unstable_cache` (in-memory ISR) with 5-min revalidate | Avoids hammering Airtable rate limits |

#### App Users (v0)

```
ALLOWED_USERS='[{"email":"founder1@airvues.com","role":"admin"},{"email":"founder2@airvues.com","role":"admin"},{"email":"lead1@airvues.com","role":"lead"},{"email":"lead2@airvues.com","role":"lead"},{"email":"lead3@airvues.com","role":"lead"},{"domain":"airvues.com","role":"engineer"}]'
```

NextAuth Email provider validates against the list at sign-in. Upgrade path to Vercel Postgres adapter once we want self-service invites + last-seen tracking.

### 6c. Airtable schema additions required

Every net-new field is enumerated with table + owner.

| Table | Field | Type | Reason | Owner |
|---|---|---|---|---|
| Subscriptions `tblZnJdKLwgj5GMOb` | `Category` | singleSelect: Database / Hosting / Comms / Banking / Payments / Meetings / AI / Calendar / Other | Powers Stack section grouping | Admin |
| Subscriptions | `Health` | singleSelect: Healthy / Warn / Down | Powers Stack health pills | Admin |
| Subscriptions | `URL` | url | Quick link to vendor admin | Admin |
| Subscriptions | `Owner` | singleCollaborator | Who owns the renewal/account | Admin |

### 6d. "Since yesterday" activity feed — concrete spec

**Approach:** Hourly Vercel Cron writes a snapshot of tracked fields to Vercel KV; on each home-page render, server diffs the most recent snapshot against the second-most-recent + adds same-day "create" events from createdTime fields.

**Snapshot schema** (Vercel KV):
```ts
type Snapshot = {
  capturedAt: string;        // ISO timestamp
  records: Array<{
    table: 'Invoices' | 'Form Submissions' | 'Quotes';
    recordId: string;
    fieldId: string;
    value: string | number | null;
  }>;
};
// Key: `snapshot:${ISO}`. TTL: 49 hours (keeps 2-3 snapshots, room for cron retries).
```

**Tracked fields per table** (enumerated, not all-fields):
- Invoices: `Invoice Status` (`fldQTgMQ7RfXDzStJ`), `Invoice Amount` (`fldjH62YX2hE2ZzKd`)
- Form Submissions: `Feasibility Status` (`fldIwOPnPxwBFmmQs`)
- Quotes: `Status` (singleSelect — record real fldID), `Quote Last Access` (`fldIYXqOtAyFEyH99`)

**Cron:** `vercel.json` schedules `/api/cron/snapshot` at `0 * * * *` (top of every hour). First run with no prior snapshot logs a warning and writes baseline; activity feed renders empty until a second snapshot exists.

**Activity event types:**
| Type | Computed from |
|---|---|
| Invoice paid | snapshot diff: `Invoice Status` changed `→ 'paid'` in last 24h |
| New lead | `Form Submissions.createdTime` (`fldiSkrSb0IjqN5eK`) within last 24h AND not in terminal states |
| Quote viewed | snapshot diff: `Quote Last Access` advanced AND `Status='Sent. Awaiting Approval.'` |
| Pipeline move | snapshot diff: `Feasibility Status` changed |
| Overdue alert | live calc: `Invoice Status IN ('open','sent','past due')` AND days-since-`Date` > 30 |

**Fallback if Vercel KV unavailable on cold-start:** activity strip renders only the `createdTime`-based events ("New leads") + the live overdue calc, omits diff-based events. No crash.

**Total schema changes: 4 fields, 1 table.** All on Subscriptions. No other table modified for MVP1.

**Deferred to Phase 2 (admin to confirm before adding):**

| Table | Field | Type | Reason |
|---|---|---|---|
| Client Feedback `tbl4GlNscZUI3XXwU` | `Escalation Severity` | singleSelect: None / Low / High | Replaces the rating-≤2 proxy with a real escalation flag |
| Client Feedback | `Resolved` | checkbox | Closes the loop on tracked escalations |

## 7. Auth & permissions

### Sign-in (revised 2026-04-26 — Google Workspace, was Email magic link)
1. User visits any protected route → redirected to `/login`.
2. "Sign in with Google" button → OAuth flow with `hd=airvues.com` (Google enforces Workspace domain at the consent screen — non-airvues.com accounts cannot complete sign-in).
3. After Google returns → session created (JWT, 30d).
4. Email matched against `ALLOWED_USERS` → role attached to session.
5. Admins with personal Gmail addresses are also allowed — handled by removing the `hd` domain restriction and using `ALLOWED_USERS` as the single gate. (See `docs/auth-architecture-2026-05-17.md` for the decided approach.)

### Permission checks
Two layers:

**Layer 1 — middleware (route-level):**
```
/(app)/*          → require session
/(app)/settings/* → require admin role
/(app)/money/*    → require admin OR editor
```

**Layer 2 — server action / API route:**
Every mutation re-checks permission via `requireRole(session, 'admin' | 'editor')`. No client-derived role is ever trusted.

### Role-gated UI elements (server-rendered)
- Login users panel on home → `admin` only
- Comp / equity columns on Team → `admin` only
- Receivables ageing panel → `admin` and `editor`
- KPI hero $ amounts → all roles see %; only admin/editor see absolute $

## 8. KPI computations

### Caching strategy
All KPI queries flow through `lib/kpi/*.ts` modules that:
1. Fetch from Airtable via the server-only `airtable.ts` client
2. Return shape: `{ value: number, delta: number | null, target?: number, asOf: Date, ttl: 300 }`
3. Wrapped in Next.js `unstable_cache` with 5-min revalidation, tagged for invalidation on writes
4. Surfaced via `/api/kpis` for client-side refresh

### Per-KPI definition (verified against live schema)

```
revenue_ytd     = SUM(Invoices.Invoice Amount) WHERE Invoice Status='paid' AND Date >= 2026-01-01
mrr             = SUM(Invoices.Invoice Amount) WHERE Invoice Type='Recurring' AND Invoice Status='paid'
                                             AND Date in current calendar month
sprint_delivery = AVG over last 4 done sprints of:
                    COUNT(Stories where Story Status='Completed' AND Sprint linked)
                  / COUNT(Stories where Sprint linked)
escalations_mtd = COUNT(Client Feedback) WHERE Overall Review <= 2
                                             AND createdTime in current month
                  // proxy until Escalation Severity field is added (Phase 2)
on_retainer_pct = COUNT(Companies where Contract Type='Membership' AND Engagement Frequency='Active')
                / COUNT(Companies where Engagement Frequency='Active')
renewal_rate    = derived in lib/kpi/renewal.ts:
                    cohort = Companies with Contract Type='Membership'
                             AND first invoice 12-13 months ago
                    renewed = those with at least one invoice in trailing 12 months
                    if cohort.length < 5: return { value: null, note: 'Insufficient cohort history (need 5+ memberships ≥12 mo old)' }
                    else: rate = renewed.length / cohort.length
csat            = AVG(Client Feedback.Overall Review)
                  WHERE createdTime >= today - 90 days
                  // displayed as X.X / 5
```

Targets are pulled from `2026 Yearly Planning/Airvues_2026_Master_Plan.md` and hardcoded in `lib/kpi/targets.ts` for v1. Phase 2 moves them to an Airtable Accounts row so non-engineers can adjust without a deploy.

### Field-ID guarantee

Every KPI query references field IDs (e.g., `fldoaqHFvhedHfRd6` for `Overall Review`), not field names. Field renames in Airtable don't break the dashboard.

**`scripts/verify-schema.ts`** (concrete spec):
- Runs as a `prebuild` npm script (also wired as a GitHub Action on PR open)
- Fetches `https://api.airtable.com/v0/meta/bases/app4vhhWMbRFOloOU/tables` using `AIRTABLE_TOKEN`
- Walks every `fld...` referenced in `lib/schema.ts` (compile-time const map)
- Asserts each field exists on its expected table AND its type matches the expected type (e.g., `Invoice Amount` must be `currency`)
- Exits 1 on any missing or type-mismatched field; build fails; PR blocked
- Logs a clear diff to console: `❌ Invoices.Invoice Amount: expected currency, found number`

## 8.1 States — loading, error, empty, partial

| State | Behavior |
|---|---|
| **Cold load** (cache miss) | Each KPI tile renders a skeleton (gray rectangle, animated shimmer) until its calculator resolves. Section panels render header + skeleton rows. Total cold-paint target: <1.5s. |
| **Warm load** (cache hit, <5 min old) | Render synchronously via RSC. No skeletons. |
| **Per-tile failure** | If one KPI calculator throws, that tile renders `—` with a quiet `⚠ retry` link; other tiles render normally. Failure logged to Vercel logs + Slack webhook. |
| **Airtable 5xx / total outage** | Top of page shows a banner: `⚠ Airtable is unreachable. Showing last cached values from {asOf}.` All cached values still render; mutations disabled (forms show "Saving disabled — try again in a few minutes"). |
| **Empty: no clients** | Top revenue clients panel: `No paid invoices yet this year. Once you ship, they'll show here.` |
| **Empty: no Subscriptions** (<3 rows) | Stack section: `Set up your stack →` CTA linking to `/stack` add-row form. |
| **Empty: no done sprints** | Sprint delivery KPI: `—` with tooltip `No completed sprints yet`. |
| **Empty: insufficient renewal cohort** | Renewal rate KPI: `—` with tooltip `Need 5+ memberships ≥12 mo old to compute` (per §8 logic). |
| **Permission-denied access** | Server-rendered 403 page with sign-out + sign-in-as-different-user link. |
| **Auth expired** | Redirect to `/login?from=<current-path>` and resume after sign-in. |

## 9. Visual design

Locked direction is documented in `mockups/founder-home-v2.html` (v2.1). Key principles:

- **Typography:** Inter (body, brand) · Instrument Serif (H1 + H2 only — limited to display) · JetBrains Mono (every numeric).
- **Color:** Airvues navy `#2D3D4F` primary · cool background `#F5F8FA` (matches existing brand kit) · accent `#C7B89A` (warm) used only on the hero KPI label · signal up/down/warn from a fixed semantic palette.
- **Grid:** 1px-seam grid (gap-px on dark background, light cells) for tables and tile layouts. Ports to Tailwind without custom math.
- **Density:** Founder-home density = scannable in <5s. Tables left-aligned, numerics right-aligned with tabular-nums. No icons in KPI tiles — numbers carry the weight.
- **Motion:** First-paint staggered reveal (~0.6s total). No on-route-change reveals. No pulsing live dots. Hover micro-interactions limited to row-bg-shift on tables.
- **Mobile:** Three breakpoints — desktop ≥1080px · tablet 720-1079 · mobile <720. Top nav hides on mobile (use a settings menu); ticker hides <1200; pipeline lanes stack; tables drop `.hide-sm` columns.
- **No editorial framing.** No issue numbers, "Authored by," colophons. Greeting + data-driven standfirst only.

## 10. Open questions / risks

> Verified against live base 2026-04-24. Items marked **resolved** have been answered by direct schema inspection or by Lee. Items marked **decided** were resolved during brainstorming.

| # | Question | Status | Resolution |
|---|---|---|---|
| 1 | Does Client Feedback have an explicit "escalation" field? | **Resolved** | No. Only 10 fields (Feedback ID, Client Intake, Testimonial, How can we improve?, Overall Review, Follow up, Full Name, Title, Company, ProjectNumber). MVP1 uses `Overall Review ≤ 2` as proxy. Phase 2 adds `Escalation Severity` + `Resolved` (see §6c) |
| 2 | Canonical renewal event? | **Decided** | No native renewal log. `lib/kpi/renewal.ts` derives via cohort: Membership companies with first invoice 12-13 months ago vs. those with an invoice in trailing 12 months. Documented in §8 |
| 3 | Sprint delivery — rollup or derived? | **Resolved** | Derived. No `Sprints.completion` rollup exists. Computed live from `Stories.Story Status` + `Stories.📆Sprints` link. See §8 |
| 4 | Pipeline source of truth — Form Submissions vs Quotes vs Leads? | **Decided** | `Form Submissions.Feasibility Status` (12 stages, mapped to 4 home lanes — see §6a). Leads table ignored in MVP1; consolidation is a separate cleanup |
| 5 | Stack data source — Subscriptions table or `lib/stack.ts` config? | **Decided** | Subscriptions table + 4 net-new fields (Category, Health, URL, Owner). See §6c |
| 6 | Equity % visible to non-admins? | **Decided** | No. Admin-only. Server-rendered gate; column omitted entirely from non-admin Team view |
| 7 | App Users storage — env allowlist or Postgres? | **Decided** | Env allowlist for v0 (zero infra). Postgres adapter in Phase 2 when self-service invites needed |
| 8 | NextAuth v4 vs v5? | **Decided** | v4 (stable). Reassess at build start; if v5 has shipped stable by then, switch |
| 9 | `ops.airvues.com` DNS owner? | **Open — Lee + Enrique** | Confirm domain is registered to Airvues LLC, not Enrique personally. Affects long-term control |
| 10 | "Since yesterday" feed — what counts as a change? | **Decided** | Status moves (computed via Vercel KV hourly snapshot diff) + invoices marked paid + new Form Submissions + Quote Last Access events + invoices >30 days unpaid. Tunable after first week |
| 11 | `CLAUDE.md` says 30 tables; live base has 32 (added: Leads, Internal Commission Tracker, Document Templates, Proposal Philosophy Airvues) | **Action** | Update `Airvues/CLAUDE.md` table inventory after spec is approved |
| 12 | Internal Commission Tracker (`tblZq696m9iqO30ps`) — surface in MVP1 or defer? | **Decided** | Defer to Phase 2 as `/money/commissions` view. Out of scope for MVP1 founder home |
| 13 | Airvues Expenses (`tblhQ9jkgVAuG97gg`, 25f) — surface in MVP1? | **Open — Lee** | Master plan mentions "expense tracking" as a Q2 KPI extension. Decide: add expense KPI tile to home now, or defer to a `/money` sub-view |
| 14 | Time Entries (`tblKfmzZ0LtndU0CO`) and Sprint Capacity — Phase 2 confirmed? | **Decided** | Phase 2. Read-only summaries on home pulled from existing rollups; full time-entry UI ships later |

## 11. Risks

- **Airtable rate limits.** 5 req/s base limit. Founder home triggers ~10 parallel queries on first paint. Mitigation: server-side fan-out with concurrency cap of 4, plus 5-min `unstable_cache`. Force-refresh hits cache, not Airtable.
- **Field renames in Airtable break the dashboard silently.** Mitigation: `lib/schema.ts` references field IDs (not names); CI step `scripts/verify-schema.ts` diffs live Meta API against the map and fails build on drift.
- **Scope creep.** 7 sections + 7 KPIs + role-gating + 4 schema additions is already a lot. Mitigation: Phase 2 enumerated in §12; reject anything not on the MVP1 list during first build.
- **Brand drift.** Mockup has been pulled to brand-kit standard, but features grow the temptation to deviate. Mitigation: CSS variables locked in `app/globals.css` with a comment pointing to this spec.
- **Stale schema in `Airvues/CLAUDE.md`.** It documents 30 tables; live base has 32. The spec uses live data, but downstream agents reading CLAUDE.md will be off. Mitigation: post-spec, update CLAUDE.md table inventory (filed as §10 #11).
- **Pipeline stage drift.** `Feasibility Status` has 12 stages today; if Lee adds new ones the 4-lane mapping breaks. Mitigation: `lib/schema.ts` enumerates expected stages; unknown stages render in a "Other" lane with a warning toast for admins.
- **Subscriptions table is sparse today.** Most rows are likely missing — Lee will need to populate before `/stack` is meaningful. Mitigation: Stack section renders a "Set up your stack →" empty state if <3 rows; one-time backfill is a 30-min task once schema additions land.
- **Deploy / preview environments share prod Airtable.** Vercel preview deployments per PR all read/write the same `app4vhhWMbRFOloOU` base. Acknowledged risk: a preview can mutate production data. Mitigation for v0: preview env vars include `READONLY_MODE=true`, which short-circuits all mutation handlers with a 403; confirmation banner displayed. Phase 2: separate sandbox base.
- **Rollback strategy:** Vercel keeps every deploy promoteable from the dashboard. If a release breaks the home page, rollback is one click. No DB migration to undo (Airtable is shared); the 4 schema additions in §6c are additive-only and safe to leave on rollback.

## 12. Phase 2 (out of scope for MVP1, but design accommodates)

- `/time` — time-entry against stories. Form on Story detail; daily summary view. Writes to `Time Entries` (`tblKfmzZ0LtndU0CO`).
- `/standups` — async daily standup post; writes to `Team Resource Allocation & Daily Standups` (`tbl5x2jqUPHcAoKci`). Slack webhook out.
- `/stories` — kanban board for active sprint stories with drag-to-move, comments. Reads/writes `Stories`.
- Notifications — Slack webhook for overdue invoices, escalations, new leads.
- Client portal slice — separate `/portal/[clientId]` with magic-link auth for clients to view their projects + invoices.
- Vercel Postgres adapter for self-service user invites.

## 13. Success criteria

MVP1 is shippable when:

- [ ] Lee can sign in via magic link, see all 7 home sections with live Airtable data, on desktop AND iPhone.
- [ ] Enrique can sign in and see the same.
- [ ] At least one contractor (Cody) signs in and sees the role-gated viewer experience (no comp, no app users panel, no $ amounts).
- [ ] Adding a new Subscriptions row in Airtable reflects on `/stack` within 5 minutes (cache TTL).
- [ ] Editing a client's `Engagement Frequency` in the dashboard updates Airtable within 2 seconds and shows in `/clients` immediately.
- [ ] All 7 KPIs compute without manual intervention; values reconcile within 1% of Airtable's own rollups for the 5 metrics that have rollups.
- [ ] No Airtable token appears in the production JS bundle (verified via `grep` on `.next/static`).
- [ ] Page lighthouse score ≥85 on desktop, ≥75 on mobile.
- [ ] All 14 open questions in §10 resolved or explicitly accepted as deferred to Phase 2 (currently 4 still open: #9 DNS, #13 Expenses tile, #11 CLAUDE.md update, plus general acceptance).
- [ ] Spec frozen — any change to writable surface, role permissions, or KPI definitions after MVP1 ships requires a follow-up spec.

## 14. References

- Mockup: `mockups/founder-home-v2.html` (historical, v2.1 agent-reviewed)
- Live schema source of truth: `lib/schema.ts`
- Verified field-ID inventory: see §6a tables; canonical source is the live Meta API at `https://api.airtable.com/v0/meta/bases/app4vhhWMbRFOloOU/tables` (run `scripts/verify-schema.ts` to validate)
- Current state of the build: [`/CLAUDE.md`](../../CLAUDE.md) and [`/HANDOVER.md`](../../HANDOVER.md)
