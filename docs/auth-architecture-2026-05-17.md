# Auth Architecture — airvues-ops

**Date drafted:** 2026-05-17
**Status:** Specification, ready for Phase 1 implementation
**Authors:** Architecture + audit agents (background research dispatched 2026-05-17)

## TL;DR

- **Provider:** NextAuth Google OAuth (kill SAML, kill shared password).
- **Identity:** signed-in email → `People.Primary Email` → `personId`.
- **Roles:** 4-value enum (`admin / lead / engineer / client`), sourced from `ALLOWED_USERS` env JSON.
- **Why SAML failed:** `app_not_configured_for_user` was Google Admin → Apps → SAML app → User access being OFF for the relevant OU. Lee being Super Admin doesn't grant access to the SAML app itself.
- **Why OAuth wins:** ~25-30 LOC to get from current state to working. Code already 90% wired.

## Migration phases

### Phase 0 — TODAY (no auth change)
- Keep shared password `12345`. Builds keep working.
- `/me` route accepts `?as=<personId>` query param. Lee can view any engineer's scorecard via picker.
- This unblocks Tier 2/3 dashboard work without auth gating it.

### Phase 1 — Switch to Google OAuth (1-2 days)
- Create OAuth 2.0 client in Google Cloud Console.
- Add `https://airvues-ops.vercel.app/api/auth/callback/google` to authorized redirect URIs.
- Set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `NEXTAUTH_URL` in Vercel.
- Remove `hd: "airvues.com"` from `lib/auth.ts:56` — it blocks admins signing in with personal Gmail addresses. Allowlist via `ALLOWED_USERS` instead.
- Replace login page password form with "Sign in with Google" button.
- Update `lib/session.ts` to prefer NextAuth over the SAML cookie.
- DELETE: `lib/saml.ts`, `lib/samlSession.ts`, `app/api/auth/saml/*`, `app/api/auth/password/login/route.ts`.
- Total change: ~25-30 LOC.

### Phase 2 — Roles + `/me` resolution (3-5 days)
- New `AppRole = "admin" | "lead" | "engineer" | "client"`.
- New `lib/people.ts → resolvePersonByEmail(email)` with cached Airtable lookup.
- Extend `AppSession` to include `personId`, `personType`, `internalType`.
- New `lib/authz.ts` with `requireRole(...roles)` + `requirePerson()` helpers.
- Each protected page calls `requireRole(...)` once at the top.

### Phase 3 — Field-level redaction (3-5 days)
- New `lib/visibility.ts` with `redactPerson(person, viewerRole, viewerPersonId)` and `redactCompany(...)`.
- Wire into `/team`, `/money`, `/engineering`.
- Add row-level checks to Server Actions for `engineer` role (e.g., "can only mutate stories where People contains my personId").

### Phase 4 — Client portals (future)
- New `/client-portal/[companyId]` route.
- `client` role scoped via `People.Company` link.
- All other routes return 404 for `client` viewers.

## Data visibility matrix

| Page | admin | lead | engineer | client |
|---|---|---|---|---|
| `/` | full | hide Comp Outflow tile, per-person money | KPIs only, no money | 404 |
| `/money` | full | Revenue + AR only | 404 | 404 |
| `/pipeline` | full | full | read-only | own Company rows |
| `/engineering` | full | edit any story | edit only own assignments | 404 |
| `/clients` | full | full | read, no Stripe ID / LTV | own Company row |
| `/team` | full | hide Comp / Equity / PandaDoc / PII | name + role + status only | 404 |
| `/stack` | full | full | full | 404 |
| `/me` | own + admin "View as" picker | own | own | n/a |

## Identity quirks

- **Bracho×2, Jose×2, Cody×2, Shania×2 duplicate People records** — the audit flagged these. `resolvePersonByEmail` returns the canonical record by these tiebreakers: `Status=Active` → `Type∈{Internal, Internal team member}` → earliest `Created` → lowest record ID.
- **`PERSON_OVERRIDES` env JSON** lets us pin specific email→recId mappings during dedupe (`{"jose@airvues.com":"recXXXX"}`).
- **Admins signing in with personal Gmail addresses** (no `@airvues.com` row in People) — handled by `PERSON_OVERRIDES`: `{"<personal-email>":"<People recId>"}`.

## Files to touch (Phase 1)

- `lib/auth.ts` — remove `hd: "airvues.com"`, confirm `ALLOWED_USERS` parsing.
- `lib/session.ts` — drop SAML branch, NextAuth-only.
- `middleware.ts` — drop `hasValidSamlCookie`, NextAuth-only + `AUTH_BYPASS`.
- `app/(auth)/login/page.tsx` — Google button only.
- `app/api/auth/[...nextauth]/route.ts` — confirm export.
- `app/api/auth/password/login/route.ts` — DELETE.
- `app/api/auth/saml/` — DELETE entire dir.
- `lib/saml.ts`, `lib/samlSession.ts` — DELETE.
- `.env.local.example` — strip SAML/ACCESS_PASSWORD entries.
- Vercel env-vars panel — same cleanup.

## Current auth code state (audit summary)

- `app/api/auth/password/login/route.ts` is the **only path working today**. Every login becomes the same shared `team@airvues.com` admin user, which is why `/me` can't auto-resolve identity.
- `lib/auth.ts` (NextAuth) is fully coded but dormant. `AUTH_GOOGLE_ID`/`SECRET` are placeholder values in `.env.local`.
- `lib/saml.ts`, `lib/samlSession.ts`, `app/api/auth/saml/*` are fully coded and dormant. Gated by `AUTH_METHOD=saml`.
- `middleware.ts` accepts either SAML cookie OR NextAuth cookie. Has `AUTH_BYPASS` kill switch and `DEV_PREVIEW` for local.
- `lib/session.ts` resolves identity in order: SAML cookie → NextAuth `auth()`. Both produce the same `AppSession` shape.

## Status

Phase 1 completed 2026-05-18 — Google OAuth live, password + SAML dormant. See `docs/auth-runbook-google-oauth.md`.
Phase 2 (Airtable role resolution) — `lib/people.ts` resolver shipped 2026-05-19; still uses `ALLOWED_USERS` env JSON as authoritative role source until People dedupe completes.
Phase 3 (field-level redaction) — not started.
Phase 4 (client portals) — not started.
