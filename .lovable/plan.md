## Goal

Stop using `ALLOWED_USERS` role assignments to gate edit rights. Every signed-in user gets write access; page-level access continues to be controlled by Airtable People.Permissions.

## Changes

### 1. `lib/authz.ts` — `canMutate()` returns true for any signed-in user
- Remove the `MUTATE_ROLES` allowlist check.
- New behavior: `canMutate()` returns `true` whenever there is a session, regardless of role.
- Keep `requireRole(...)` intact as a primitive (still used by a few upload routes), but stop using it to enforce write vs read.

### 2. `lib/mutations/*` — loosen `requireRole` calls
Every mutation currently calls `requireRole("admin", "lead", "editor")`. Replace those with a new helper `requireSignedIn()` (added to `lib/authz.ts`) that only checks a session exists. Files touched:
- `lib/mutations/client.ts`
- `lib/mutations/company.ts`
- `lib/mutations/founder.ts`
- `lib/mutations/invoice.ts`
- `lib/mutations/lead.ts`
- `lib/mutations/loop.ts`
- `lib/mutations/meeting.ts`
- `lib/mutations/person.ts`
- `lib/mutations/project-log.ts`
- `lib/mutations/quote.ts`
- `lib/mutations/sprint-capacity.ts`
- `lib/mutations/sprint.ts`
- `lib/mutations/story.ts`

### 3. Upload routes — allow any signed-in user
- `app/api/quotes/upload/route.ts`: change `requireRole("admin","lead","editor")` → `requireSignedIn()`.
- `app/api/loops/upload/route.ts`: already includes `engineer`; switch to `requireSignedIn()` for consistency.
- `app/api/leads/upload/route.ts` and `app/api/meetings/upload/route.ts`: same treatment.

### 4. Sign-in gate — keep, but note behavior
- `lib/auth.ts` `signIn` callback still uses `findRole()` to gate who can sign in. **Not changing this now** — removing it would let any Google account in. The `ALLOWED_USERS` JSON continues to serve as the "who is allowed to sign in at all" list, but it no longer controls what they can do once in.
- If you'd rather have Airtable People also be the sign-in gate (deny sign-in when no People row matches the email), that's a separate follow-up — say the word and I'll add it.

## Result

- Every signed-in user can edit everything the UI exposes to them.
- What each user *sees* (sidebar entries, page access) remains driven by Airtable `People.Permissions` via `lib/permissions.ts` + `lib/page-guard.ts`.
- Engineer on the retainer timesheets page will now see the "+ Add story" button and be able to save.

## Verification

- `npx tsc --noEmit` + `npm run build`.
- Sign in as an engineer-role user in preview, open `/engineering/retainer-timesheets`, confirm the add-story button renders and a story can be created.
