# OAuth Runbook — Google Sign-In Setup

> **Status:** Historical reference. This runbook describes the OAuth setup that was completed on 2026-05-18, replacing the prior password + dormant SAML setup. Kept as documentation of the current auth provider configuration in case the OAuth client ever needs to be rotated or recreated.

**Outcome:** team signs in with `@airvues.com` Google accounts (and allowlisted personal Gmail addresses for admins), each user gets their real identity + role from `ALLOWED_USERS` env JSON.

`/me` auto-resolves to the signed-in user via `lib/people.ts` (no more `?as=` query param).

## Prereqs

- Super Admin access to `airvues.com` Google Workspace
- Vercel project access to `airvues-ops`

---

## Step 1 — OAuth client (~10 min)

1. Open https://console.cloud.google.com/apis/credentials
2. Top dropdown: select the `airvues-ops` project (or create one if rotating).
3. **Configure OAuth consent screen** (left rail):
   - User Type: **Internal** (Workspace-only + personal allowlist via `ALLOWED_USERS`)
   - App name: `Airvues Ops`
   - User support email: an `@airvues.com` admin
   - Developer contact: same
   - Save and continue through scopes (default `email`, `profile`, `openid` plus `calendar.readonly` and `gmail.readonly` for the TopBar widgets)
4. **Credentials → + CREATE CREDENTIALS → OAuth client ID**:
   - Application type: **Web application**
   - Name: `airvues-ops production`
   - **Authorized JavaScript origins:** `https://airvues-ops.vercel.app`
   - **Authorized redirect URIs:**
     - `https://airvues-ops.vercel.app/api/auth/callback/google`
     - (local dev) `http://localhost:3000/api/auth/callback/google`
   - Create. Copy the **Client ID** and **Client secret**.

## Step 2 — Vercel env vars (~5 min)

Vercel dashboard → `airvues-ops` → Settings → Environment Variables. Add for **Production**:

| Key | Value |
|---|---|
| `AUTH_GOOGLE_ID` | (from Step 1) |
| `AUTH_GOOGLE_SECRET` | (from Step 1) |
| `NEXTAUTH_URL` | `https://airvues-ops.vercel.app` |
| `AUTH_SECRET` | random 32-byte hex; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` if missing |
| `ALLOWED_USERS` | (see Step 3) |
| `PERSON_OVERRIDES` | (optional) JSON `{email: recId}` for users whose primary email doesn't match Airtable People |

Should NOT be set (relics of pre-OAuth setup):
- `ACCESS_PASSWORD`, `AUTH_METHOD`, `AUTH_BYPASS`, any `SAML_*` variables

## Step 3 — `ALLOWED_USERS` role map

Source of truth for who gets in + role. JSON array. Entries are either `{email, role}` or `{domain, role}`. Email matches beat domain matches.

```json
[
  {"email":"founder1@airvues.com","role":"admin"},
  {"email":"founder2@airvues.com","role":"admin"},
  {"email":"lead1@airvues.com","role":"lead"},
  {"email":"lead2@airvues.com","role":"lead"},
  {"email":"lead3@airvues.com","role":"lead"},
  {"domain":"airvues.com","role":"engineer"}
]
```

Roles:
- **admin** — founders. Everything visible, everything writeable.
- **lead** — trio leads. Most visible, can edit any story / quote. Sensitive comp fields hidden.
- **engineer** — ICs. Read mostly, edit only own assignments.
- **client** — reserved for Phase 4 portals.

The `{"domain":"airvues.com","role":"engineer"}` wildcard auto-onboards new Workspace hires as engineer; promote them later by adding a higher-priority email entry.

## Step 4 — Code (completed 2026-05-18)

Code changes made when the flip was executed:
1. Removed `hd: "airvues.com"` restriction from `lib/auth.ts` — allowed admins with personal Gmail addresses.
2. Made `lib/session.ts` prefer NextAuth over any lingering SAML cookie.
3. Replaced password form with "Sign in with Google" on `/login`.
4. Deleted `app/api/auth/password/login/route.ts` (password route).
5. Left SAML files dormant (`lib/saml.ts`, `lib/samlSession.ts`, `app/api/auth/saml/*`) for graceful fallback on legacy cookies.
6. Stripped the SAML branch out of `middleware.ts`.

Subsequent additions (2026-05-19):
- Added `calendar.readonly` + `gmail.readonly` scopes for TopBar widgets.
- Added `prompt: "consent"` + `access_type: "offline"` to guarantee refresh tokens.
- Added `refreshGoogleAccessToken()` for silent refresh within 60s of expiry.

## Step 5 — Verify

After deploy:
1. Open https://airvues-ops.vercel.app in incognito.
2. "Sign in with Google" → click.
3. Sign in as an allowlisted account. Should land on `/`.
4. Visit `/me` — should auto-resolve to the signed-in user (or show "no People record" if email isn't matched in Airtable).
5. Sign in as another admin. Confirm role=admin reflects.
6. Test a lead account — confirm `/team` hides Comp Amount fields.
7. Test an engineer account — confirm story-edit gating works.

Vercel logs: `vercel logs airvues-ops`

## Why not SAML

Previous SAML setup got blocked by Google's `app_not_configured_for_user` error. Root cause was likely:

> Google Admin → Apps → Web and mobile apps → `airvues-ops` → User access set to "OFF for everyone" or scoped to an OU that didn't include the test user.

Being Super Admin doesn't auto-grant access to a SAML app — per-app User access is separate. SAML could be revived later but Google OAuth is simpler for the team's scale.

## Why not magic-link / email OTP

Adds infra (Resend/SES), worse UX than "Sign in with Google" for a Workspace team. Team is already in Google Workspace, OAuth is the natural choice.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Error 400: redirect_uri_mismatch" | Google Console missing callback URL | Add `https://airvues-ops.vercel.app/api/auth/callback/google` to OAuth client redirect URIs |
| "Access blocked: not approved" | Consent screen needs verification (External user type only) | Use Internal user type when configuring consent screen |
| Sign-in works but 403 in app | Email not in `ALLOWED_USERS` | Add email + role to JSON in Vercel, redeploy |
| `/me` shows "no People record" | Email doesn't match `People.Primary Email` in Airtable | Add email to People record, OR set `PERSON_OVERRIDES` env JSON to map email → recId |
| Calendar/Gmail "not connected" after sign-in | Scopes not granted on initial consent | Sign out, sign back in to trigger fresh consent screen with new scopes |
| Token expired errors after ~1h of use | `refresh_token` not issued | Confirm `prompt: "consent"` + `access_type: "offline"` in `lib/auth.ts` provider config |
