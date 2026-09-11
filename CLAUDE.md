# CLAUDE.md — Rules of the Game

> Read this entirely before touching code. These rules exist because something already broke when they weren't followed.
>
> **Last updated:** 2026-09-11 (delete/archive model + /archive restore page; 2026-06 nav restructure + People.Permissions view gating + Loops/Meetings/Founder + Cmd+K)

## What this is

Internal operations dashboard for Airvues LLC. Next.js 14 App Router on Vercel. Reads + writes Airtable base `app4vhhWMbRFOloOU`. Used by the COO, CTO, the trio (leads), engineers, and contractors. **Production. Real data. Real revenue numbers.**

URL: `https://airvues-ops.vercel.app`

## Stack

- **Framework:** Next.js 14 App Router (Server Components + Server Actions)
- **Language:** TypeScript strict mode
- **Styling:** Tailwind CSS, dark theme, JetBrains Mono numerics
- **Data:** Airtable REST API via `lib/airtable.ts` (server-only)
- **Auth:** NextAuth v5 Google OAuth + email/domain allowlist (role) + `People.Permissions` (view access)
- **Media:** Vercel Blob (`BLOB_READ_WRITE_TOKEN`) for Loop/Meeting recordings + quote/lead uploads
- **AI:** Lovable AI Gateway → `google/gemini-2.5-flash` for Loop/Meeting transcription (`LOVABLE_API_KEY`, `lib/transcribe.ts` + `lib/transcribe-meeting.ts`; audio extracted via bundled `ffmpeg-static`)
- **Deploy:** Vercel (production + preview)
- **Node:** Whatever Next.js 14 supports (18+)

## Commands

- `npm run dev` — local dev (needs `.env.local`)
- `npx tsc --noEmit` (alias `npm run build:dev`) — typecheck, must pass before shipping
- `npm run build` — production build, must pass before shipping
- `npm run lint` — Next.js ESLint
- `npm run verify-schema` — validates `lib/schema.ts` field IDs against the live Airtable Meta API
- No test suite exists. Verification = typecheck → build → deploy → curl routes.

## ⛔ DO NOT — hard rules

These break things. Do not bypass.

1. **DO NOT** import `lib/airtable.ts` from a client component. It has `"server-only"` and contains the `AIRTABLE_TOKEN`. Pass data down from Server Components instead.
2. **DO NOT** mutate Airtable without calling `requireRole(...)` first. Every Server Action in `lib/mutations/` already does this — keep it that way. See `lib/authz.ts`.
3. **DO NOT** hardcode field names in mutations. Field names like `"Story Status"`, `"📆Sprints"` come from `lib/schema.ts` keys. The emoji in `"📆Sprints"` is `U+1F4C6` (calendar) — byte-exact matters.
4. **DO NOT** confuse `Story.Status` (lowercase p: `"In progress"`) with `Sprint.Status` (capital P: `"In Progress"`). Two different fields, two different conventions. Both are correct.
5. **DO NOT** write to `support@airvues.com` or treat it as a person. It's a placeholder mailbox — caused 150 unrouted payments. Never assign work to it or use it as a Payee.
6. **DO NOT** create new role values outside the 4-role enum (`admin / lead / engineer / client`). Legacy `editor / viewer` still parse but don't add more synonyms.
7. **DO NOT** commit `.env.local`, `scripts/output/*.json`, or anything from the credentials vault. `.gitignore` catches the obvious cases — verify before you stage.
8. **DO NOT** bypass `requireRole` with "I'll just check role in the client". Client-side role is spoofable. Server-side gate is the only gate.
9. **DO NOT** make Airtable PATCH/POST calls outside `lib/airtable.ts`. The wrapper handles batching, rate limiting, typecast.
10. **DO NOT** add a third place for routes. `lib/nav.ts` is the single source of truth. Sidebar + MobileNav + home Jump-To all consume it.
11. **DO NOT** ship without running `npx tsc --noEmit` AND `npm run build`. Type errors and build failures should never reach prod.
12. **DO NOT** invent field IDs. Always extract from `lib/schema.ts`. Wrong IDs silently no-op on writes.
13. **DO NOT** add a list read of People / Companies / Quotes without `filterByFormula: "NOT({Archived})"` if that list feeds a board, picker, filter or search. Archived = soft-deleted; it must not be selectable anywhere. Joins and name lookups (resolving a recId to a name on an existing record) are the exception — they keep archived rows so historical records still render.
14. **DO NOT** hard-delete anything that carries money or identity. Projects, retainers, accounts and people archive only. Stories and sprints hard-delete, and `deleteStory` refuses when 🔵 Team Task Payments are attached (`lib/delete-guards.ts`).
15. **DO NOT** gate a page by hiding it from the nav only. Sidebar filtering is cosmetic — the real gate is `assertCanAccess(href)` (`lib/page-guard.ts`) at the top of the page, backed by `ROUTE_PERMISSION` in `lib/permissions.ts`.

## ✅ DO — patterns to follow

1. **Server Actions for ALL writes.** Pattern:
   ```ts
   "use server";
   import { requireRole, AuthzError } from "../authz";
   import { revalidateTag } from "next/cache";

   export async function myMutation(args) {
     try { await requireRole("admin", "lead", "editor"); }
     catch (e) { if (e instanceof AuthzError) return { error: e.reason }; throw e; }
     try {
       await patchRecords(Tables.X.id, [{ id, fields }]);
       revalidateTag("airtable"); // umbrella invalidates all cached reads
       return { ok: true };
     } catch (e) { return { error: (e as Error).message }; }
   }
   ```

2. **Cached reads via `listRecordsCached`.** Always tag for findability:
   ```ts
   await listRecordsCached(Tables.X.id, { fields: [...] }, ["my-tag"]);
   ```
   Every cached read also gets `"airtable"` automatically — that's the umbrella tag.

3. **Cache invalidation after writes.** Call `revalidateTag("airtable")` minimum. Add specific tags for documentation (`engineering:stories`, `sprints:all`, etc).

4. **Field access via schema:**
   ```ts
   import { Tables } from "@/lib/schema";
   Tables.Stories.fields["Story Status"].id  // → "fldTNsiYuGhCVx7Vy"
   ```

5. **Reuse the StorySheet drawer.** It's mounted on 6 pages. Accepts `engineers: {id, name}[]` and `canEdit: boolean`. Don't fork.

6. **Add a new page:**
   - Create `app/(app)/<name>/page.tsx` (server component)
   - Add entry to `lib/nav.ts` with `showInSidebar: true` + optionally `showOnHome: true`
   - Sidebar + MobileNav + home cards auto-update
   - If the page belongs to a gated section: add the route to `ROUTE_PERMISSION` in `lib/permissions.ts` AND call `await assertCanAccess("/<name>")` at the top of the page (`lib/page-guard.ts`). Nav hiding alone is not a gate.
   - If page links carry filter state, accept `searchParams` and seed an `initialFilter` prop

7. **Single source of truth.** Constants in `lib/`. Nav in `lib/nav.ts`. Types in `lib/*-types.ts` (client-safe). Mutations in `lib/mutations/`.

8. **Verify before claiming done.** `npx tsc --noEmit` + `npm run build` + (where relevant) live route checks. Verification pattern: typecheck → build → deploy → curl key routes.

## Delete / archive model (2026-09)

- **Only admin + lead (+ legacy editor) can delete or archive.** `deleteGate()` in `lib/authz.ts` is the server gate on every delete/archive action; `canDelete()` / `canRoleDelete(role)` (client-safe, `lib/permissions.ts`) decide whether the control renders. Delete is the *only* role-gated write left — every other mutation is `requireSignedIn()`.
- **Soft (archive):** Projects/Quotes, Companies, People via an `Archived` checkbox on each table; Retainers via the older `Retainer Archived` on Quotes; Loops/Meetings via `Deleted`. **Hard:** Stories, Sprints.
- **`/archive`** lists everything archived with a Restore button — the only way back, since archived rows are filtered out of every board, picker, filter and Cmd+K. Role-gated by `canDelete()`, nav link hidden via `requiresDelete` on the `NavItem`.
- **One confirm UI:** `components/ui/DeleteControl.tsx`. Two-step inline arm, no `window.confirm`. Don't fork it.
- `components/DeletePermission.tsx` provides `useCanDelete()` from the `(app)` layout — use it instead of threading a prop.

## Auth model (current — post 2026-05-18 OAuth flip)

- **Provider:** Google OAuth via NextAuth v5 (`lib/auth.ts`)
- **No domain hint at provider level** — `hd: "airvues.com"` was removed so admins with personal Gmail addresses can sign in.
- **Gate is `ALLOWED_USERS` env JSON:** entries are either `{email, role}` OR `{domain, role}`. Email matches beat domain matches.
  - Domain match (`{"domain":"airvues.com","role":"engineer"}`) means new `@airvues.com` Workspace hires auto-onboard as engineer.
  - Email matches bump specific people higher (founders = admin; trio leads = lead).
- **4 roles:** `admin / lead / engineer / client`. Legacy `editor / viewer` parse but are deprecated.
- **`requireRole(...allowed)` in `lib/authz.ts`** — server-side gate. Throws `AuthzError`. Call at the top of every Server Action.
- **`canMutate()`** — boolean helper for UI gating (`canEdit` prop). Returns true for admin/lead/editor.
- **Session priority in `lib/session.ts`:** NextAuth first, lingering SAML cookie as legacy fallback. Dev-only `SYNTHETIC_DEV_SESSION` if `DEV_PREVIEW` or `AUTH_BYPASS` env is set.

**Password auth was deleted on 2026-05-18.** Don't reintroduce.

**SAML files (`lib/saml.ts`, `lib/samlSession.ts`, `app/api/auth/saml/*`) are dormant.** Not deleted to preserve graceful fallback for any lingering cookies. Don't wire them back into the active path.

**Token refresh (2026-05-19):** Google access tokens expire after 1 hour. `refreshGoogleAccessToken()` in `lib/auth.ts` silently refreshes via the stored `refresh_token` when within 60s of expiry. Requires `prompt: "consent"` + `access_type: "offline"` on the initial OAuth params to get the refresh token issued.

### View permissions (added post-2026-05, separate from roles)

Two independent axes — don't conflate them:

- **Role** (`admin/lead/engineer/client` from `ALLOWED_USERS`) governs **mutations** via `requireRole(...)`. Unchanged.
- **Permissions** (`People.Permissions` multi-select in Airtable, resolved by email in `lib/people.ts`, carried on `session.user.permissions`) govern **what you can see**: nav groups, page access, conditional UI sections. Defined in `lib/permissions.ts`: `Revenue, Delivery, Engineering, Operations, Home - Firm Pulse, Scorecard - Admin, Founder`.
- Admin role does **not** bypass view permissions — an admin without the `Founder` permission should not see the Founder section.
- Server-side page gate: `assertCanAccess(href)` in `lib/page-guard.ts` (redirects to `/` if denied, `/login` if signed out). Route → permission mapping lives in `ROUTE_PERMISSION` in `lib/permissions.ts`.
- Dev bypass session gets `ALL_PERMISSIONS`.

**Quote SSO (`lib/quote-sso.ts`):** mints a short-lived (10 min) JWT signed with `QUOTE_SSO_SECRET` so ops users auto-authenticate into the separate airvues-quote app. Falls back to the plain URL if the secret or email is missing. Endpoint: `app/api/quote-sso/route.ts`.

## Nav structure (2026-06 restructure)

Groups: **Overview · Delivery · Engineering · Earnings · Operations · Founder** (`NavGroup` in `lib/nav.ts`). Renames to know about — routes did NOT change, only labels:

- `/clients` is labeled **Accounts** (Leads + Clients unified there)
- `/pipeline` is labeled **Projects**
- `/money` is labeled **Earnings**
- `/leads` is a hidden legacy route kept as fallback

## File map (current, not aspirational)

```
app/
├── (app)/
│   ├── page.tsx                  Home: personal-first landing (Your day → The board → Stack → firm snapshot)
│   ├── me/page.tsx               Personal scorecard (picker gated by "Scorecard - Admin" permission)
│   ├── loops/                    Screen+mic recordings → Blob storage → AI summary (index, new, [id])
│   ├── meetings/                 Recorded calls → AI transcripts, notes, action items (index, [id])
│   ├── money/page.tsx            Earnings: invoices + AR aging + filters
│   ├── pipeline/page.tsx         Projects (quotes funnel)
│   ├── leads/page.tsx            Legacy — hidden from nav, unified into /clients
│   ├── engineering/
│   │   ├── page.tsx              Stories grouped by engineer + leaderboard + orphan banner
│   │   └── retainer-timesheets/  Engineer-facing retainer story logging
│   ├── backlog/page.tsx          Flat table + bulk edit + NewStoryModal
│   ├── sprints/                  Index + velocity, [id] kanban, [id]/plan capacity planning
│   ├── clients/page.tsx          Accounts: leads, partners, clients
│   ├── team/page.tsx             People + payments
│   ├── stack/page.tsx            Internal SaaS subscriptions
│   ├── founder/page.tsx          Founder dashboard: scaling curves + team scaling simulator
│   ├── hygiene/                  Data quality index + orphans/ triage
│   └── layout.tsx                Sidebar + MobileNav + TopBar + auth gate
├── (auth)/login/page.tsx         Google sign-in only — branded login (aurora backdrop + particle network)
└── api/
    ├── auth/[...nextauth]/       NextAuth handler
    ├── auth/saml/                Dormant, legacy fallback only
    ├── loops|meetings|leads|quotes/upload/   Blob upload endpoints
    ├── quote-sso/                Signed JWT handoff into airvues-quote app
    └── search/                   Cmd+K search index endpoint

components/
├── One dir per page (backlog, engineering, sprints, me, hygiene, home, clients,
│   team, money, pipeline, stack, leads, loops, meetings, founder, projects)
├── search/                       CommandPalette (Cmd+K), CommandPaletteProvider, SearchTrigger
├── header/                       TopBar, CalendarWidget, GmailWidget, TimeWeatherWidget (desktop only)
├── login/                        AuroraBackdrop, ParticleNetwork, Manifesto, LiveClock
├── engineering/StorySheet        THE story drawer — mounted on 6+ pages, don't fork
├── ui/                           PageHeader, SectionTitle, StatCard, Sparkline, NumberTicker
└── Sidebar.tsx / SidebarNav.tsx / MobileNav.tsx   Nav shells (all consume lib/nav.ts)

lib/
├── airtable.ts                   Server-only client (listRecordsCached, patchRecords, createRecords)
├── schema.ts                     Field-ID map (canonical reference) — 30 tables
├── auth.ts                       NextAuth + Google + AppRole + role resolver + token refresh
├── authz.ts                      requireRole, canMutate
├── permissions.ts                People.Permissions view gating (client-safe types + route map)
├── page-guard.ts                 assertCanAccess(href) — server-side page gate
├── session.ts                    getAppSession (NextAuth + SAML fallback + dev bypass), loads permissions
├── people.ts                     session.email → People recId + Permissions (dupe tiebreakers, PERSON_OVERRIDES)
├── nav.ts                        Single source of truth for routes
├── quote-sso.ts                  Short-lived JWT for airvues-quote SSO handoff
├── uploads.ts                    Vercel Blob upload helper
├── transcribe.ts / transcribe-meeting.ts   ffmpeg audio extraction → Lovable gateway (Gemini)
├── search-index.ts               Cmd+K palette index
├── activity.ts                   Recent-activity feed derived from createdTime (no audit log yet)
├── kpi.ts / firm-pulse.ts        Firm KPIs + home snapshot
├── founder.ts / founder-math.ts / scaling-math.ts   Founder dashboard math
├── <page>.ts + <page>-types.ts   Per-page data layers (engineering, sprints, scorecard, money,
│                                 pipeline, clients, leads, loops, meetings, team, stack, hygiene,
│                                 retainer-timesheets, project-log, …) — types files are client-safe
└── mutations/                    One file per entity, all requireRole-gated:
                                  story, sprint, sprint-capacity, quote, invoice, lead, loop,
                                  meeting, person, client, company, founder, project-log

scripts/
├── hygiene-companies.mjs         One-shot reclassification script (rollback log included)
├── verify-schema.ts              CI helper — validates field IDs against live Meta API
└── output/                       (gitignored) Hygiene reports + rollback logs

docs/
├── auth-architecture-2026-05-17.md   Authz design + 4-phase migration
├── auth-runbook-google-oauth.md      OAuth setup steps (done as of 2026-05-18)
├── auth-saml-setup.md                Historical, SAML attempt notes
└── specs/2026-04-24-airvues-ops-dashboard-design.md   Original design spec
```

## Schema gotchas

- `Story.Story Status` choices: `Todo, In progress, QA Review, Completed, On Hold, Incomplete, Analysis Required, Archived`. Use exactly. Typecast helps but exact match is safer.
- `Sprint.Sprint Status` choices: `In Progress, Done, Next`. Capital P. Different from Story.
- `Priority` choices: `Urgent, High, Medium, Low`. Same on Stories.
- Stories link to Sprints via `📆Sprints` (calendar emoji + Sprints).
- Stories link to People via `Assignee` (plural — multi-assignee supported).
- `Invoice` (currency) on Story is the dollar value of THAT story (not the invoice the client paid).
- `Hours` is scoped; `Hours Worked` is manually entered (mostly empty).
- `Companies.Engagement Frequency` choices include `"Iddle"` (sic — keep the typo, that's the actual option in Airtable).
- **Completing a story creates money rows.** `updateStory`/`bulkUpdateStories` with status `Completed` auto-create one 🔵 Team Task Payment per assignee (their own `People.Commission Percentage` × `Story.Cost` — each dev gets their full rate, NOT a split; Status "Needs Payment"; routed to their open Pending expense batch, created if missing). Duplicate-guarded per story+payee. Kill switch: `DISABLE_COMPLETION_PAYMENTS=1`. Logic: `lib/completion-payments.ts`; read-only dry-run: `node scripts/completion-payments-dryrun.mjs <recId>|--scan`.

## Hygiene state (known data quality issues)

- **528 orphan Stories** — no Assignee. `/hygiene/orphans` UI exists for bulk-triage.
- **150 unrouted Team Payments** = $41K stuck on `support@airvues.com` placeholder. Auto-inference deferred.
- **People dupes:** several internal team members appear twice. Blocks Phase 2 auth migration. Use `PERSON_OVERRIDES` env JSON to pin email → canonical recId.
- **Time Entries empty** — velocity hours metrics return zero until daily logging starts.
- **"Unknown" company** — $36K attributed revenue, name is placeholder. Manual triage pending.

## Built since the original spec (don't re-propose as new)

- **Cmd+K command palette** — `components/search/` + `lib/search-index.ts` + `app/api/search/`.
- **View permissions from Airtable** — `People.Permissions` multi-select (see Auth model). Partial Phase 2: *view access* comes from the People table; *role* still comes from `ALLOWED_USERS`.
- **Loops** — in-house Loom replacement: screen+mic recording → Vercel Blob → Gemini transcript/summary.
- **Meetings** — call recordings with AI transcripts, notes, action items, lead linking.
- **Founder dashboard** — scaling curves + team scaling simulator (`Founder` permission).
- **Retainer Timesheets** — `/engineering/retainer-timesheets`.
- **Activity feed (partial)** — `lib/activity.ts` derives last-24h events from createdTime; still no mutation audit log.
- **Quote SSO** — signed handoff into the airvues-quote app.

## What's still deferred

- **Phase 2 auth (rest):** derive *role* from Airtable `People.Role` instead of `ALLOWED_USERS` env JSON. Requires People dedupe first.
- **Phase 3 auth:** field-level redaction (`lib/visibility.ts` — `redactPerson(viewerRole)`). Comp Amount, Equity %, Story.Cost should not be visible to engineers.
- **Phase 4 auth:** client portals — `/client-portal/[companyId]` scoped to one Company.
- **Drag-and-drop kanban** — sprint boards are still click-based quick-advance; `@dnd-kit` is only used in `components/pipeline/QuoteStoriesTable.tsx`.
- **Time Entries logging UI** — empty until adoption ritual exists.
- **CSV export from /backlog or /money**.
- **Mutation audit log** (who changed what, when — activity feed is inference-only).
- **Asana / GitHub PR integrations** — sketched but not built.

## How to test what you change

1. `npx tsc --noEmit` — must exit 0
2. `npm run build` — must exit 0; check route bundle sizes don't balloon
3. `vercel --prod` if pushing to prod, or push to a branch for preview
4. Curl key routes:
   ```bash
   for path in / /login /me /loops /meetings /money /pipeline /clients /engineering /backlog /sprints /founder /hygiene; do
     curl -s -o /dev/null -w "%{http_code} ${path}\n" "https://airvues-ops.vercel.app${path}"
   done
   ```
5. For mutations: do NOT test against the live base unless you've verified the field names + values match the schema. Better path: write a dry-run script first (see `scripts/hygiene-companies.mjs` for the pattern with `--apply` flag + rollback log).

## When in doubt

- **Don't corrupt the production base.** Real revenue numbers live in it. A bad PATCH can silently corrupt invoices, payments, or story commission math.
- **Read `docs/auth-architecture-2026-05-17.md`** before changing anything in `lib/auth.ts` / `lib/session.ts` / `lib/authz.ts`.
- **If a feature seems redundant,** check if it's intentional (e.g., SAML files are dormant but kept for legacy session fallback).
- **Use a subagent to audit** anything risky before shipping. Pattern: spawn read-only audit, address findings, then deploy.

## Onboarding new agents to this codebase

1. Read this file (you just did).
2. Read [`HANDOVER.md`](./HANDOVER.md) for external services, env vars, and where credentials come from.
3. Read [`docs/auth-architecture-2026-05-17.md`](./docs/auth-architecture-2026-05-17.md) and [`docs/auth-runbook-google-oauth.md`](./docs/auth-runbook-google-oauth.md).
4. Skim `lib/schema.ts` to see what tables/fields exist.
5. Run `npm run dev` locally with `.env.local` filled in. Sign in via Google. Click through every page.
6. Look at `git log` for the recent commits — they describe what was built and why.
7. **Don't ship anything you can't verify with `tsc + build + curl`.**
