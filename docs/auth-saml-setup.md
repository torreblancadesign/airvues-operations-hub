# Airvues Ops — SAML SSO Setup via Google Workspace
> Drafted: 2026-05-16

Full step-by-step to wire `airvues-ops` to your Google Workspace admin console so all access + role management happens at `admin.google.com → Apps → Web and mobile apps`.

## What this gives you

- **Sign-in:** every user goes through Google Workspace SSO (familiar Google login)
- **Access control:** assign the app to specific Org Units or Google Groups — anyone not in scope physically cannot log in
- **Role management:** create three Google Groups (admin / editor / viewer). Drag a user into a group → they get that role on next login. Remove from all groups → access revoked.
- **Offboarding:** delete a user from Workspace → instant lockout, no app-side changes needed
- **Audit trail:** Workspace admin logs every SSO event

## Architecture

```
┌─────────────┐  1. Click "Sign in"      ┌──────────────────────┐
│   Browser   │ ───────────────────────► │  airvues-ops         │
│             │                          │  /api/auth/saml/login│
│             │ ◄─── 2. AuthnRequest ─── │                      │
│             │      (XML, signed)       │                      │
│             │                          └──────────────────────┘
│             │
│             │  3. Redirect to Google   ┌──────────────────────┐
│             │ ───────────────────────► │  Google Workspace    │
│             │                          │  SAML IdP            │
│             │ ◄── 4. SAMLResponse  ─── │                      │
│             │     (email, name,        │                      │
│             │      groups[])           │                      │
│             │                          └──────────────────────┘
│             │
│             │  5. POST SAMLResponse    ┌──────────────────────┐
│             │ ───────────────────────► │  airvues-ops         │
│             │                          │  /api/auth/saml/sso  │
│             │                          │  - parse + verify    │
│             │                          │  - map groups → role │
│             │ ◄─── 6. Session cookie ──│  - set jwt cookie    │
└─────────────┘                          └──────────────────────┘
```

## Part 1 — Google Workspace admin setup (you do this)

### 1. Create role groups

In **Google Admin Console → Directory → Groups**, create:

| Group email | Purpose |
|---|---|
| `airvues-ops-admin@airvues.com` | Full admin — settings, mutations, user management |
| `airvues-ops-editor@airvues.com` | Read + edit data |
| `airvues-ops-viewer@airvues.com` | Read-only |

Add yourself + Enrique to `admin`. Add Shania/Jose/Bracho to `editor`. Add other team members to `viewer` as needed.

### 2. Create custom SAML app

**Admin Console → Apps → Web and mobile apps → Add app → Add custom SAML app**

Step 1 of 5 — **App details**
- App name: `Airvues Ops`
- Description: `Internal operations dashboard`
- App icon: (optional)

Step 2 of 5 — **Google Identity Provider details**
- ⚠️ **DOWNLOAD the metadata** at the bottom of this page — you'll send these values to Lee:
  - **SSO URL** (looks like `https://accounts.google.com/o/saml2/idp?idpid=C0xxxxxx`)
  - **Entity ID** (looks like `https://accounts.google.com/o/saml2?idpid=C0xxxxxx`)
  - **Certificate** (PEM blob starting with `-----BEGIN CERTIFICATE-----`)

Step 3 of 5 — **Service provider details**

Use these placeholder values until production URL is set:

| Field | Dev value | Prod value |
|---|---|---|
| **ACS URL** | `http://localhost:3000/api/auth/saml/sso` | `https://ops.airvues.com/api/auth/saml/sso` |
| **Entity ID** | `airvues-ops-dev` | `airvues-ops` |
| **Start URL** (optional) | `http://localhost:3000` | `https://ops.airvues.com` |
| **Name ID format** | `EMAIL` | `EMAIL` |
| **Name ID** | `Basic Information > Primary email` | same |
| **Signed response** | ✓ (recommended) | ✓ (recommended) |

⚠️ **You may need to register two SAML apps** — one for dev (`localhost`) and one for production (`ops.airvues.com`) — because Google won't accept multiple ACS URLs in one config.

Step 4 of 5 — **Attribute mapping** (this is the critical part for roles)

| Google Directory attribute | App attribute |
|---|---|
| `Primary email` | `email` |
| `First name` | `firstName` |
| `Last name` | `lastName` |

**Group membership** — click **Add group membership**:
| Google Groups | App attribute |
|---|---|
| `airvues-ops-admin`, `airvues-ops-editor`, `airvues-ops-viewer` | `groups` |

This is what sends the user's group membership down in the SAML response so the app can map them to a role.

Step 5 of 5 — **Finish**

### 3. Assign the app to users

Back on the app detail page:
- Click **User access** (currently OFF for everyone)
- Either turn ON for everyone in your Workspace, OR turn ON only for specific Org Units
- Save

If you want to be strict: turn it OFF for everyone, then add it as enabled for each Org Unit that contains team members. Or use Groups-based access: only members of the three role groups can sign in.

### 4. Send Lee the IdP metadata

From Step 2 above, send Lee:
- The **SSO URL**
- The **Entity ID**
- The **certificate** (paste the full `-----BEGIN CERTIFICATE-----` block)

He'll set these as env vars on the airvues-ops Vercel deployment.

## Part 2 — Code side (Lee does this)

### Environment variables required

```bash
# SAML SSO via Google Workspace
AUTH_METHOD=saml                                          # toggle: 'saml' enables SAML path; 'oauth' keeps existing Google OAuth

# IdP (Google Workspace SAML app) — values from Part 1 Step 2
SAML_IDP_SSO_URL=https://accounts.google.com/o/saml2/idp?idpid=C0xxxxxx
SAML_IDP_ENTITY_ID=https://accounts.google.com/o/saml2?idpid=C0xxxxxx
SAML_IDP_CERT="-----BEGIN CERTIFICATE-----
MIIDdDCCAlygAwIBAgIGAYy...
-----END CERTIFICATE-----"

# SP (Airvues Ops) — must match what Lee configured in Part 1 Step 3
SAML_SP_ENTITY_ID=airvues-ops-dev                         # 'airvues-ops' in prod
SAML_SP_ACS_URL=http://localhost:3000/api/auth/saml/sso   # 'https://ops.airvues.com/api/auth/saml/sso' in prod

# SP signing keypair (generated with openssl — see below)
SAML_SP_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
SAML_SP_CERT="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"

# Group → role mapping (defaults match the group names from Part 1 Step 1)
SAML_GROUP_ADMIN=airvues-ops-admin@airvues.com
SAML_GROUP_EDITOR=airvues-ops-editor@airvues.com
SAML_GROUP_VIEWER=airvues-ops-viewer@airvues.com
```

### Generate the SP keypair

```bash
cd ~/Desktop/Coding\ Workspace/airvues-ops
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout saml-sp-key.pem -out saml-sp-cert.pem \
  -subj "/CN=airvues-ops/O=Airvues LLC/C=US"
# Then paste the contents into SAML_SP_KEY and SAML_SP_CERT env vars
# (and gitignore the .pem files)
```

### How role mapping works

When the SAML response comes back from Google, the app:
1. Verifies the response signature against `SAML_IDP_CERT`
2. Extracts `email`, `firstName`, `lastName`, `groups[]` attributes
3. Maps groups to role with this precedence (highest wins):
   - If user is in `SAML_GROUP_ADMIN` → role = `admin`
   - Else if user is in `SAML_GROUP_EDITOR` → role = `editor`
   - Else if user is in `SAML_GROUP_VIEWER` → role = `viewer`
   - Else → access denied (user signed in but isn't in any role group)
4. Sets the session cookie (same NextAuth JWT format — middleware works unchanged)

## Part 3 — Testing checklist

After Lee configures Google Workspace AND sets the env vars locally:

- [ ] Visit `http://localhost:3000/api/auth/saml/metadata` — should return valid SP metadata XML (paste this URL into Google's "Service provider details" if it ever rejects manual config)
- [ ] Click "Sign in with Google Workspace" on `/login`
- [ ] Should redirect to `accounts.google.com` SAML SSO page
- [ ] After Google login, redirect back to airvues-ops home
- [ ] Masthead shows your role (admin/editor/viewer) matching your Google Group
- [ ] Try signing in as a teammate in a different group → verify they get the correct role
- [ ] Try signing in as someone NOT in any role group → should see "Access denied" page (not silently log in)
- [ ] Remove yourself from `airvues-ops-admin` → re-login → should get a lower role
- [ ] Sign out works
- [ ] Production: same flow but on `ops.airvues.com`

## Alternative — simpler "Google OAuth + Directory API groups" (consider this if SAML is too heavy)

For 8 internal users, a simpler path is to keep the existing Google OAuth flow but add a **Google Workspace Directory API** call after login to fetch the user's groups. Same admin-console-managed permissions, no SAML XML/cert plumbing.

That requires:
- Service account with domain-wide delegation
- `https://www.googleapis.com/auth/admin.directory.group.readonly` scope
- A call to `directory.groups.list?userKey={email}` on login

If you decide SAML is overkill for the current team size, switch `AUTH_METHOD=oauth-groups` (Phase 2 — not yet built) and we'll wire this up instead. For now, code defaults to `AUTH_METHOD=oauth` (current allowlist) until SAML env vars are configured.

## Rollback

If SAML breaks in production:
1. Set `AUTH_METHOD=oauth` in Vercel env vars
2. Redeploy (or trigger redeploy)
3. Login falls back to the existing Google OAuth + `ALLOWED_USERS` allowlist path

Both paths coexist in code — no need to revert commits.

## Related

- Repo CLAUDE.md: [`/CLAUDE.md`](../CLAUDE.md)
- Auth code: `lib/auth.ts`, `lib/saml.ts` (new), `lib/session.ts`
- API routes: `app/api/auth/saml/*`
