# CLAUDE.md — Rules of the Game

> Read this entirely before touching code. These rules exist because something already broke when they weren't followed.
>
> **Last updated:** 2026-05-19 (TopBar widgets + personal-first home + people resolver)

## What this is

Internal operations dashboard for Airvues LLC. Next.js 14 App Router on Vercel. Reads + writes Airtable base `app4vhhWMbRFOloOU`. Used by the COO, CTO, the trio (leads), engineers, and contractors. **Production. Real data. Real revenue numbers.**

URL: `https://airvues-ops.vercel.app`

## Stack

- **Framework:** Next.js 14 App Router (Server Components + Server Actions)
- **Language:** TypeScript strict mode
- **Styling:** Tailwind CSS, dark theme, JetBrains Mono numerics
- **Data:** Airtable REST API via `lib/airtable.ts` (server-only)
- **Auth:** NextAuth v5 Google OAuth + email/domain allowlist
- **Deploy:** Vercel (production + preview)
- **Node:** Whatever Next.js 14 supports (18+)

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
   - If page links carry filter state, accept `searchParams` and seed an `initialFilter` prop

7. **Single source of truth.** Constants in `lib/`. Nav in `lib/nav.ts`. Types in `lib/*-types.ts` (client-safe). Mutations in `lib/mutations/`.

8. **Verify before claiming done.** `npx tsc --noEmit` + `npm run build` + (where relevant) live route checks. Verification pattern: typecheck → build → deploy → curl key routes.

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

## File map (current, not aspirational)

```
app/
├── (app)/
│   ├── page.tsx                  Home: personal-first landing (Your day → The board → Stack → firm snapshot)
│   ├── me/page.tsx               Personal scorecard (admin picker until People-table auth)
│   ├── money/page.tsx            Invoices + AR aging + filters
│   ├── pipeline/page.tsx         Quotes funnel
│   ├── engineering/page.tsx      Stories grouped by engineer + leaderboard + orphan banner
│   ├── backlog/page.tsx          Flat table + bulk edit + NewStoryModal
│   ├── sprints/
│   │   ├── page.tsx              Index with velocity overview
│   │   ├── [id]/page.tsx         Kanban board
│   │   └── [id]/plan/page.tsx    Capacity planning
│   ├── clients/page.tsx          Companies list
│   ├── team/page.tsx             People + payments
│   ├── stack/page.tsx            Internal SaaS subscriptions
│   ├── hygiene/
│   │   ├── page.tsx              Data quality index
│   │   └── orphans/page.tsx      Orphan story triage
│   └── layout.tsx                Sidebar + MobileNav + TopBar + auth gate
├── (auth)/login/page.tsx         Google sign-in only — branded login with aurora backdrop + particle network
└── api/
    ├── auth/[...nextauth]/       NextAuth handler
    └── auth/saml/                Dormant, legacy fallback only

components/
├── backlog/                      Backlog table, bulk-bar, NewStoryModal
├── engineering/                  Board, StoryCard, StorySheet (drawer), Leaderboard, FilterBar
├── sprints/                      KanbanCard, SprintBoard, SprintPlanBoard, SprintRow, VelocityOverview, NewSprintModal
├── me/                           PersonScorecard, PersonPicker
├── hygiene/                      OrphanTriage, OrphanGroupCard
├── home/                         HomeKpiCard, HomeJumpCard, CompanyGoals, GoalBar, YourDay, DeparturesBoard (StationBoard), TheStack
├── header/                       TopBar, CalendarWidget, GmailWidget, TimeWeatherWidget (sticky topbar, desktop only)
├── login/                        AuroraBackdrop, ParticleNetwork, Manifesto, LiveClock (login brand expression)
├── clients/                      ClientsDashboard, ClientSheet
├── team/                         TeamDashboard
├── money/                        MoneyDashboard, InvoiceTable, InvoiceSheet, ArAgingChart, FilterBar
├── pipeline/                     PipelineDashboard, QuoteTable, QuoteSheet, FilterBar
├── stack/                        StackDashboard
├── ui/                           PageHeader, SectionTitle, StatCard, Sparkline, NumberTicker
├── SidebarNav.tsx                Desktop nav (client — uses usePathname for active state)
├── Sidebar.tsx                   Desktop nav shell
└── MobileNav.tsx                 Mobile drawer nav

lib/
├── airtable.ts                   Server-only client (listRecordsCached, patchRecords, createRecords)
├── schema.ts                     Field-ID map (canonical reference) — 30 tables
├── auth.ts                       NextAuth + Google + AppRole + role resolver + token refresh
├── authz.ts                      requireRole, canMutate
├── session.ts                    getAppSession (NextAuth + legacy SAML fallback + dev bypass)
├── nav.ts                        Single source of truth for routes
├── engineering.ts                + engineering-types.ts — board data
├── scorecard.ts                  + scorecard-types.ts — /me data
├── sprints.ts                    + sprints-types.ts — sprint data
├── sprint-plan.ts                + sprint-plan-types.ts — planning data
├── velocity.ts                   Multi-sprint stats
├── orphan-triage.ts              + orphan-triage-types.ts — hygiene
├── hygiene.ts                    Index data
├── quotes-light.ts               Quote picker options
├── kpi.ts                        Firm KPIs (revenue, MRR, AR, retainer, sprint delivery)
├── landing.ts                    Home Departures + Arrivals operational state
├── personal-landing.ts           Home "Your day" — assigned stories + today's events for the signed-in user
├── people.ts                     Resolve session.email → People recId (canonical-record tiebreakers for dupes)
├── calendar.ts                   Server-only Google Calendar reader (uses session.accessToken)
├── gmail.ts                      Server-only Gmail reader — unread inbox list
├── weather.ts                    Vercel edge geo headers + Open-Meteo (10-min cache)
├── clients.ts, team.ts, stack.ts Per-page data layers
├── money.ts, pipeline.ts         Per-page data layers
└── mutations/
    ├── story.ts                  updateStory, bulkUpdateStories, planStory, setStorySprint, createStory
    └── sprint.ts                 createSprint, updateSprintStatus

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

## Hygiene state (known data quality issues)

- **528 orphan Stories** — no Assignee. `/hygiene/orphans` UI exists for bulk-triage.
- **150 unrouted Team Payments** = $41K stuck on `support@airvues.com` placeholder. Auto-inference deferred.
- **People dupes:** several internal team members appear twice. Blocks Phase 2 auth migration. Use `PERSON_OVERRIDES` env JSON to pin email → canonical recId.
- **Time Entries empty** — velocity hours metrics return zero until daily logging starts.
- **"Unknown" company** — $36K attributed revenue, name is placeholder. Manual triage pending.

## What's deferred (clearly documented as TODO)

- **Phase 2 auth:** derive role from Airtable `People.Role` instead of `ALLOWED_USERS` env JSON. Requires People dedupe first.
- **Phase 3 auth:** field-level redaction (`lib/visibility.ts` — `redactPerson(viewerRole)`). Comp Amount, Equity %, Story.Cost should not be visible to engineers.
- **Phase 4 auth:** client portals — `/client-portal/[companyId]` scoped to one Company.
- **Deep-link param hydration** on `/pipeline`, `/clients`, `/sprints` (only `/backlog` and `/money` parse `?status=` / `?scope=` today).
- **Drag-and-drop kanban** — currently click-based quick-advance + ship buttons.
- **Time Entries logging UI** — empty until adoption ritual exists.
- **CSV export from /backlog or /money**.
- **Global search bar / Cmd+K command palette**.
- **Activity feed** (who changed what, when).
- **Asana / GitHub PR integrations** — sketched but not built.

## How to test what you change

1. `npx tsc --noEmit` — must exit 0
2. `npm run build` — must exit 0; check route bundle sizes don't balloon
3. `vercel --prod` if pushing to prod, or push to a branch for preview
4. Curl key routes:
   ```bash
   for path in / /login /me /money /engineering /backlog /sprints /hygiene; do
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
