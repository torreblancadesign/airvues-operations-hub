## Problem

The plumbing in `lib/session.ts` → `resolvePersonByEmail()` → `lib/people.ts` is wired correctly in principle (SSO email → lowercase → `LOWER({Primary Email}) = "..."`), but in practice permissions are coming back empty for real users. Likely causes, in order of probability:

1. **Field-list mixing IDs with a name.** `listRecords` passes `fields[]=fldXXX` for the schema fields plus `fields[]=Permissions` for the new one. Airtable accepts both, but `returnFieldsByFieldId` is left at default (false), so the response is keyed by field **name**. That should work — but if the Permissions field's real name in Airtable contains an emoji or trailing space (the base has prior offenders like `📆Sprints` and `"Iddle"`), `f.Permissions` will be `undefined`.
2. **SSO email ≠ People.Primary Email.** Founder/admin emails on `@gmail.com` won't match People rows that store the `@airvues.com` address (or vice-versa). `findRole()` already handles this for role via `ALLOWED_USERS`, but `resolvePersonByEmail` has no such alias map — so the resolver returns `null` and `permissions` is `[]`.
3. **Stale `unstable_cache` entry** from before the field was added — unlikely (cache key includes `opts` which now contains `"Permissions"`), but worth flushing.
4. **Permissions field is empty on the matched record** — just data-entry, not a bug, but indistinguishable from #1/#2 without logging.

## Plan

### 1. Add targeted server logs (temporary, behind `DEBUG_PERMISSIONS=true`)

In `lib/people.ts` `resolvePersonByEmail`, when env flag is on, log:
- the lowercase email being searched
- number of records returned by the filterByFormula
- the winning record's `id`, `fields["Primary Email"]`, and `fields.Permissions` (raw)
- the keys present on `fields` (so we can see if it came back as `"Permissions"`, `"Permissions "`, `"🔐 Permissions"`, etc.)

In `lib/session.ts` `getAppSession`, log the resolved `email` and final `permissions` array for the request.

This is the only way to tell #1 vs #2 vs #4 apart in production without guessing.

### 2. Make the field lookup name-robust

In `lib/people.ts`:
- Switch the `fields[]` request to use the field **name** `"Primary Email"` etc. consistently (or all IDs with `returnFieldsByFieldId: true` and key the response by ID). Mixing is the smell. Names are easier here because we already key the row by name (`f["Full Name"]`).
- After fetching, find the Permissions value by scanning keys: `Object.entries(f).find(([k]) => k.trim().toLowerCase() === "permissions")` — defensive against an accidental emoji/whitespace in the field name. Use that value as the raw permissions array.

### 3. Add an email-alias path for SSO mismatch

- Reuse the existing `PERSON_OVERRIDES` env JSON pattern. It already maps `email → recId` for the dupe-People case; extend `resolvePersonByEmail` so that if the lowercase email is in `PERSON_OVERRIDES`, it fetches that record directly (this already works) — but **also** add a secondary lookup: if no record matches by `Primary Email`, optionally try a second field. Cheapest: add an env `PERSON_EMAIL_ALIASES` JSON `{ "lee@gmail.com": "lee@airvues.com" }` and re-run the lookup with the aliased email before giving up. Document in `CLAUDE.md`.

### 4. Cache hygiene

- Bump the cache tag for the people-by-email query so old entries (if any) are invalidated: change tag from `people:by-email:${lower}` to `people:auth:v2:${lower}`. Adds a `revalidateTag("airtable")` is unnecessary — cache key change is enough.

### 5. Verification

1. Set `DEBUG_PERMISSIONS=true` in Vercel preview, redeploy.
2. Sign in as the test user, hit `/`. Read Vercel logs to confirm:
   - Email being searched matches what's in People.Primary Email
   - Permissions array is non-empty
   - Sidebar reflects the correct groups
3. If logs show the field key is unexpected (e.g. trailing space), fix in Airtable OR pin the schema in `lib/people.ts` accordingly.
4. Turn off `DEBUG_PERMISSIONS` once green.
5. `npx tsc --noEmit` + `npm run build`.

## Out of scope

- Phase 2 auth migration (role from People.Role).
- Field-level redaction.
- Building a Permissions admin UI inside the dashboard — Airtable remains the editor.

## One question before I implement

Which is the right behavior when a signed-in user has **no Permissions set in their People row** (field empty)?
- **(a) deny everything** — only Home + My Scorecard visible, no Firm Pulse, picker locked to self. Safest default.
- **(b) grant all view permissions** — backwards compatible until everyone gets permissions assigned.
- **(c) grant based on `Internal Type` / `Role`** — e.g. engineers get Delivery, leads get all three.

If you don't answer I'll go with **(a)**.
