# HANDOVER

> Entry point for anyone (or any AI) picking up this repo. Read this in full before making changes.

**Repo:** `airvues-ops/airvues-ops` on GitHub
**Production:** https://airvues-ops.vercel.app
**Status (2026-05-19):** all 22 routes live, OAuth + role-gated mutations shipped, personal-first home page + TopBar widgets (Calendar/Gmail/Time-Weather) shipped today.

## Reading order for a new owner

1. **This file** — external services, env vars, where credentials live, what was just shipped.
2. **[`CLAUDE.md`](./CLAUDE.md)** — DO / DO NOT rules, file map, schema gotchas, hygiene state, deferred items.
3. **[`README.md`](./README.md)** — page index, local dev steps, deploy.
4. **[`docs/auth-architecture-2026-05-17.md`](./docs/auth-architecture-2026-05-17.md)** — 4-phase auth migration plan. Phase 1 done, Phase 2 partial, Phase 3-4 deferred.
5. **[`docs/auth-runbook-google-oauth.md`](./docs/auth-runbook-google-oauth.md)** — what was configured in Google Cloud + Vercel for the OAuth setup. Reference when rotating credentials.
6. **`lib/schema.ts`** — canonical Airtable schema (30 tables, all field IDs). Single source of truth for field access.

After that, `git log --oneline -20` gives the recent change history.

## External services this app depends on

| Service | What it's for | How to access |
|---|---|---|
| **Airtable** | All operational data — Clients, People, Stories, Sprints, Invoices, Quotes, etc. | Base ID `app4vhhWMbRFOloOU`. Personal Access Token in `AIRTABLE_TOKEN` env. |
| **Vercel** | Hosting + auto-deploy on push to `main` | Project: `airvues-ops` in the `airvues1s-projects` team. GitHub integration wired — no manual `vercel --prod` needed for prod. |
| **GitHub** | Source control | `airvues-ops/airvues-ops` (org-owned). Main branch is `main`. |
| **Google Cloud Console** | OAuth client + Calendar + Gmail API enablement | Project: `airvues-ops` (project number `316327064020`). Required APIs enabled: Google Calendar API, Gmail API. Client ID stored in `AUTH_GOOGLE_ID`. |
| **Google Workspace (`airvues.com`)** | Identity provider | Super Admin manages user accounts. OAuth consent screen is **Internal** user type — only `@airvues.com` accounts (plus allowlisted personal emails) can complete sign-in. |
| **Open-Meteo** | Weather data for TopBar widget | Free, no key. Hit from `lib/weather.ts`. |

## Environment variables (full inventory)

All values live in **Vercel → airvues-ops → Settings → Environment Variables**. For local dev, mirror into `.env.local` (gitignored).

| Variable | Purpose | Where to get the value |
|---|---|---|
| `AIRTABLE_TOKEN` | Server-side reads + writes to base `app4vhhWMbRFOloOU` | Airtable account → Developer Hub → Personal Access Tokens. Scope: read+write on this one base. |
| `AIRTABLE_BASE_ID` | `app4vhhWMbRFOloOU` | Hardcoded — Airtable base URL. |
| `AUTH_GOOGLE_ID` | OAuth client ID | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → `airvues-ops production`. |
| `AUTH_GOOGLE_SECRET` | OAuth client secret | Same place as `AUTH_GOOGLE_ID`. Treat as secret. |
| `AUTH_SECRET` | NextAuth JWT signing key | Random 32-byte hex. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Do not rotate without invalidating active sessions. |
| `NEXTAUTH_URL` | Canonical app URL for OAuth callback | `https://airvues-ops.vercel.app` in prod, `http://localhost:3000` in local dev. |
| `ALLOWED_USERS` | Per-email + per-domain role allowlist | JSON array. See [`docs/auth-runbook-google-oauth.md`](./docs/auth-runbook-google-oauth.md) Step 3. |
| `PERSON_OVERRIDES` (optional) | Map signin email → People recId, for users whose Airtable email differs from their Google email | JSON object. Example: `{"founder@gmail.com":"recXXXX"}`. Useful during the People dedupe window. |
| `AUTH_BYPASS` | Dev-only — bypass auth and return synthetic admin session | `true` to bypass. Never set in prod. |
| `DEV_PREVIEW` | Dev-only — same as `AUTH_BYPASS` | `true` to bypass. |

## What ships when you push to `main`

GitHub → Vercel integration is connected. Every push to `main` triggers a production deploy. Build runs `next build` with TypeScript strict mode — if `npx tsc --noEmit` or `npm run build` fails locally, it will fail in CI and not deploy.

Manual deploy (only needed if GitHub integration is broken):
```bash
vercel --prod
```

Inspect builds:
```bash
vercel ls airvues-ops --prod        # last few deployments
vercel logs <deployment-url>        # runtime logs for a specific deploy
```

## Recent additions (2026-05-19, may not be in CLAUDE.md's "Last updated" list)

Shipped today, in order:
1. **Brand-styled login page** — aurora drift backdrop, canvas particle network, manifesto cross-fade, UTC live clock. Files: `components/login/*`.
2. **TopBar** with three widgets (sticky top, desktop only):
   - **CalendarWidget** — next meeting + agenda panel with Join links for video calls. `components/header/CalendarWidget.tsx`, data: `lib/calendar.ts`.
   - **GmailWidget** — unread count chip + recent inbox panel. `components/header/GmailWidget.tsx`, data: `lib/gmail.ts`.
   - **TimeWeatherWidget** — local time + 5 world clocks + weather card. `components/header/TimeWeatherWidget.tsx`, data: `lib/weather.ts`.
3. **Google token refresh** — `lib/auth.ts` adds `refreshGoogleAccessToken()` so Calendar/Gmail stay live past the 1-hour access-token expiry. Requires `prompt: "consent"` + `access_type: "offline"` in the OAuth params (set).
4. **`lib/people.ts`** — `resolvePersonByEmail(email)` resolves the signed-in user to their People recId. Tiebreakers: Active first, Internal type, earliest createdTime. `PERSON_OVERRIDES` env lets us pin specific email → recId mappings while People dedupe is pending.
5. **Personal-first home page** — `app/(app)/page.tsx` rebuilt. Order now: Your day (today's calendar + your stories in flight) → The board (team-wide Departures + Arrivals) → THE STACK → Firm snapshot. Old KPI grid + 2026 Goals + Jump-to grid removed. Data: `lib/personal-landing.ts`, components: `components/home/YourDay.tsx`.
6. **Greeting now uses People.First Name** — `firstName(name, email)` resolves via the People resolver, falls back to Google OAuth name, then to email username, then to "there".

## What's deferred (in order of likely value)

1. **Cmd+K command palette** — fastest jumps to clients, stories, quotes, people. Highest UX leverage.
2. **Asana action items chip** in the TopBar — pulls unfinished tasks for the signed-in user. MCP available.
3. **Sprint pulse strip** — thin band under the TopBar showing current sprint + days left + done count.
4. **GitHub PR queue chip** — your open PRs + PRs awaiting your review.
5. **Phase 2 auth finish** — drive role from `People.Role` instead of `ALLOWED_USERS` env. Blocked on People dedupe.
6. **Phase 3 auth — field-level redaction** (`lib/visibility.ts`). Hide Comp Amount, Equity %, Story.Cost from non-admins.
7. **Phase 4 auth — client portals** at `/client-portal/[companyId]`.
8. **Drag-and-drop kanban**, **CSV exports**, **global search**, **activity feed**, **Time Entries logging UI**.

Full list in [`CLAUDE.md`](./CLAUDE.md) "What's deferred".

## Known data hygiene issues (real, affect the dashboard)

- **528 orphan Stories** (no Assignee) — `/hygiene/orphans` UI exists for bulk-triage.
- **150 unrouted Team Payments** ($41K) — stuck on `support@airvues.com` placeholder mailbox. Never write to this email.
- **People duplicates** — several internal team members appear twice. Blocks Phase 2 auth. Use `PERSON_OVERRIDES` env to pin canonical recIds in the meantime.
- **Time Entries table empty** — velocity hour metrics return zero until daily logging starts.
- **"Unknown" company** has $36K attributed revenue. Manual triage pending.

## Verification before pushing

Run all three before claiming work is done:
```bash
npx tsc --noEmit       # must exit 0
npm run build          # must exit 0
# Optional smoke test against prod after deploy:
for path in / /login /me /money /engineering /backlog /sprints /hygiene; do
  curl -s -o /dev/null -w "%{http_code} ${path}\n" "https://airvues-ops.vercel.app${path}"
done
```

If any mutation is in scope, also follow the "do not test against the live base" pattern: dry-run script first, with `--apply` flag and a rollback log (see `scripts/hygiene-companies.mjs`).

## Where credentials live (not what they are)

- **Vercel** — production env vars. Source of truth for prod.
- **Local** — `.env.local` (gitignored). Mirror Vercel values for local dev. **Never commit.**
- **`.credentials/` directory** — gitignored, may exist on a developer's machine for offline reference. Never push to the repo.
- **Google Cloud Console** — OAuth client + API enablement. Anyone with Editor/Owner on the `airvues-ops` GCP project can rotate the secret.
- **Airtable** — Personal Access Tokens are scoped per-user. If you need a token for CI or a new developer, generate a new PAT scoped to base `app4vhhWMbRFOloOU` with read+write and webhook scopes.

If a credential is missing or expired:
- `AIRTABLE_TOKEN` expired → generate new PAT in Airtable → update Vercel + redeploy → update `.env.local` if dev locally.
- `AUTH_GOOGLE_SECRET` rotated → grab from GCP Console → update Vercel → redeploy.
- `AUTH_SECRET` rotated → users will need to sign in again (all sessions invalidated).

## Common operations

```bash
# Trigger a fresh deploy without code changes
git commit --allow-empty -m "Trigger redeploy" && git push

# Inspect a failing deploy
vercel logs <deployment-url>

# Verify schema field IDs are still valid
npx tsx scripts/verify-schema.ts

# Run hygiene script (DRY RUN — no writes)
node scripts/hygiene-companies.mjs

# Run hygiene script (LIVE — writes to Airtable, generates rollback log)
node scripts/hygiene-companies.mjs --apply
```

## Contact

- **Lee Tsao** (COO, original builder) — ltsao@airvues.com
- **Enrique Torreblanca** (CTO) — enrique.torreblanca@airvues.com
