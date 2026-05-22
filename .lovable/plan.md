## Goal

Drive per-user access from the new `People.Permissions` multi-select. Five option values:

- `Revenue` — access to Leads, Sales Pipeline, Earnings, Clients
- `Delivery` — access to Engineering, Backlog, Sprints
- `Operations` — access to Team, Stack, Hygiene
- `Home - Firm Pulse` — show the Firm Pulse section on the home page
- `Scorecard - Admin` — can view anyone's scorecard via the picker; without it, /me is locked to the signed-in user (no picker)

Home and My Scorecard are always visible to everyone (they're personal). `admin` role (founders, from `ALLOWED_USERS`) bypasses all permission checks.

## Implementation

### 1. Permissions plumbing

- `lib/permissions.ts` (new): export `Permission` union + `Permissions` set type + helpers `hasPermission(perms, p)`, `canAccessGroup(perms, NavGroup)`, `canAccessRoute(perms, href)`, and the nav-group → permission map (`revenue → "Revenue"`, etc.). `admin` role → all permissions granted.
- `lib/people.ts`: add `permissions: Permission[]` to `ResolvedPerson`, request the `Permissions` field from Airtable, parse the multi-select string array.
- `lib/session.ts`: extend `AppSession.user` with `permissions: Permission[]`. In `getAppSession`, after resolving NextAuth/SAML session, call `resolvePersonByEmail` to enrich with permissions. Synthetic dev session gets all permissions. Cache the People lookup per request (e.g., React `cache()`).

### 2. Nav filtering

- `components/Sidebar.tsx` (server) and `components/SidebarNav.tsx`: pass permissions down, filter `NAV_ITEMS` by `canAccessRoute`. Hide entire groups when empty.
- `components/MobileNav.tsx`: same filter applied to its `NAV_ITEMS` traversal.
- `app/(app)/layout.tsx`: pass `session.user.permissions` into Sidebar + MobileNav.

### 3. Route guards

- `app/(app)/layout.tsx`: add a helper that checks the current pathname against `canAccessRoute(permissions, pathname)`. If denied, redirect to `/` (or render a small "No access" page under the existing shell). Implement by reading `headers()`'s `x-pathname` (set via `middleware.ts` if not already) — or simpler: add a single server `<RouteGuard pathname={...}>` wrapper. Since Next can't read pathname server-side without middleware, add `middleware.ts` (or extend existing) to set `x-pathname` header.
- Alternative (preferred, less plumbing): add `assertCanAccess(href)` helper and call it at the top of each protected `page.tsx`. List of pages to gate: `/leads`, `/pipeline`, `/money`, `/clients`, `/engineering`, `/backlog`, `/sprints/*`, `/team`, `/stack`, `/hygiene/*`. Will go with this approach — explicit and consistent with existing `requireRole` pattern.

### 4. /me changes

- `app/(app)/me/page.tsx`:
  - Resolve current user's person id via `resolvePersonByEmail(session.user.email)`.
  - If `permissions` does NOT include `Scorecard - Admin` AND role !== `admin`: ignore `?as=` param, force `engineerId = currentPersonId`. If no person record matched, show a friendly "We couldn't find your engineer record" message.
  - If admin/scorecard-admin: keep current behavior (picker + ?as= param).
- `components/me/PersonScorecard.tsx`: accept `canSwitchPerson: boolean` prop; only render `<PersonPicker>` when true.
- Header strip: when not switchable, drop the picker entirely (the user's name in the H1 is enough).

### 5. Home page Firm Pulse gating

- `app/(app)/page.tsx`: only render the Firm Pulse section + its `SectionTitle` + "Open Earnings →" link when `session.user.permissions` includes `Home - Firm Pulse` (or role=admin). Everything else on the home page stays.

### 6. Airtable field

- The `Permissions` field is added in Airtable (per screenshot). Field ID is not yet in `lib/schema.ts` — `lib/people.ts` will pass the field by name (`"Permissions"`) the same way `Annual Earnings Goal` and `Commission Percentage` are read in `lib/scorecard.ts`. Schema regen out of scope here.

## Out of scope

- Server Actions / mutations are still gated by `requireRole(...)`. Permissions are read-only/view-only gating; no changes to write authorization.
- Field-level redaction (Phase 3 from the auth doc) — separate effort.
- Client portals (Phase 4).

## Verification

1. `npx tsc --noEmit` and `npm run build` clean.
2. Sign in as a user with only `Delivery` + `Scorecard - Admin`: sidebar shows Home, My Scorecard, Engineering, Backlog, Sprints only. Hitting `/money` directly redirects to `/`. Firm Pulse hidden on home. `/me` picker visible.
3. Sign in as an engineer with no special permissions: only Home + My Scorecard visible; `/me` lands directly on their scorecard, no picker, no `?as=` honored.
4. Sign in as admin: everything visible, Firm Pulse shown, picker on /me works.
