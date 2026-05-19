## Status

Auth handlers are now correctly at `app/api/auth/[...nextauth]/route.ts` and `app/api/auth/saml/*` ✅

**But** the old copies at `app/auth/[...nextauth]/` and `app/auth/saml/` are still there — duplicates that will register phantom `/auth/...` routes and confuse Next. Need to delete them.

Plus the Lovable scaffolding I flagged before is still there.

## Cleanup to execute

### 1. Delete duplicate auth folder
- `app/auth/` (entire dir — duplicates of what's now in `app/api/auth/`)

### 2. Delete Lovable scaffolding
- `src/` (entire dir — TanStack Start router, routes, components, hooks, styles)
- `vite.config.ts`
- `wrangler.jsonc`
- `bunfig.toml`
- `bun.lock`
- `.next/` (stale build cache if present)
- `eslint.config.js` (Lovable flat config; Next 14 uses its own — repo can re-add `.eslintrc.json` later if wanted)
- `components.json` (shadcn config — real repo doesn't use shadcn)

Leave alone (already Next-correct): `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `next.config.js`, `middleware.ts`, `package.json`, `next-env.d.ts`, `.prettierrc`, `.prettierignore`.

### 3. Patch `.gitignore`
Append:
```
# Next.js
.next/
out/

# Env
.env*.local

# Vercel
.vercel/

# Project-specific
scripts/output/
```

### 4. Reinstall deps cleanly
- `rm -rf node_modules`
- `npm install` (produces `package-lock.json` — matches Vercel + Claude Code locally)

### 5. Verification (best-effort)
- `npx tsc --noEmit`
- `npm run build` — likely fails without `.env.local` because `lib/auth.ts` throws if `ALLOWED_USERS` is missing in production-mode builds. That's an env concern, not code. I'll report whatever it says.

## What this does NOT fix

- **Lovable's preview pane will still show errors** ("Module not found: ./globals.css", etc.) — the Lovable sandbox runs Vite + TanStack Start and can't run Next.js. From here on, dev/preview happens via `npm run dev` locally (localhost:3000) and Vercel preview deploys per branch. Lovable's job is GitHub-sync code edits only.
- Production env vars (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_USERS`, `AIRTABLE_TOKEN`) live in Vercel — not touched here.

Approve and I'll execute steps 1–5.