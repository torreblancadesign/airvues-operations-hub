## What's wrong

NextAuth v5 builds the OAuth callback URL from either the `AUTH_URL` env var or the incoming request host. On your new Vercel project:

1. **`AUTH_URL` is not set** → NextAuth falls back to its default (`http://localhost:3000`), which is what Google receives as the `redirect_uri`.
2. **Google OAuth client only has the old project's callback registered** → even once we fix #1, Google will reject the new domain until it's whitelisted.

There's also a latent issue in `lib/auth.ts`: no `trustHost: true` is set. On Vercel this normally isn't required when `AUTH_URL` is set, but adding it makes the app resilient to preview deployments (each preview gets a unique URL).

## Steps

### 1. Add env vars on the new Vercel project
In **Vercel → Settings → Environment Variables** for the new project, add (for Production + Preview + Development as appropriate):

- `AUTH_URL` = `https://<your-new-vercel-domain>` (e.g. `https://airvues-ops-v2.vercel.app` or your custom domain — no trailing slash)
- `AUTH_TRUST_HOST` = `true` (lets preview deployments work without setting AUTH_URL per-branch)

Verify these are also present (they should already be, since login was previously redirecting at all):
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `ALLOWED_USERS`

### 2. Update Google Cloud Console
In **Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client**:

- Under **Authorized redirect URIs**, add:
  `https://<your-new-vercel-domain>/api/auth/callback/google`
- Keep the old URI too if the old project still needs to work; otherwise remove it.
- Under **Authorized JavaScript origins**, add:
  `https://<your-new-vercel-domain>`

Save. Changes propagate within a few minutes.

### 3. Redeploy
After adding env vars on Vercel, trigger a redeploy (env var changes don't auto-redeploy). Then test sign-in.

### 4. (Optional, recommended) Code hardening
Add `trustHost: true` to the NextAuth config in `lib/auth.ts` as a belt-and-braces measure so the app respects `x-forwarded-host` even if `AUTH_URL` is ever missing on a preview branch.

```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [ /* ... */ ],
  // ...
});
```

This is a one-line change to a single file — happy to make it once you approve.

## How to verify

1. Visit `https://<new-domain>/login`
2. Click "Sign in with Google"
3. URL during consent should show `redirect_uri=https://<new-domain>/api/auth/callback/google` (not localhost)
4. After consent, you should land on `/` (or the `from` param), authenticated.

If you still see localhost after step 3, double-check `AUTH_URL` was saved on the correct environment (Production vs Preview) and that you redeployed.
