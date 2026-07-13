
## Goal

When an engineer clicks "Web Quote ↗" from airvues-ops, the quote app (`airvues-quote.vercel.app`) should recognize the visitor as the `Prepared For` person and skip the email-entry step — without weakening the existing "enter your email" gate for people who arrive at the URL cold.

## Recommended approach: signed SSO token in the URL

Airvues-ops mints a short-lived JWT that says "this link authenticates {email} for {quoteId}", signs it with a shared secret, and appends it to the Web Quote URL. The quote app verifies the signature, and if valid, sets its own session cookie and drops the user straight into the quote. If the token is missing/expired/invalid, the quote app falls back to today's email-entry flow — nothing regresses.

Why this over alternatives:
- **Signed JWT (chosen):** no network call between apps, no DB coupling, works offline of any shared backend, standard primitive both projects already have via `jose`. Trivially revocable by rotating the shared secret.
- **Server-to-server magic-link API:** requires airvues-ops to call the quote app to mint a one-time token per click, adds latency + a new endpoint + failure mode. Overkill.
- **Full OIDC / shared NextAuth:** correct long-term, way too heavy for one link.

## Changes in airvues-ops (this app)

1. **New secret `QUOTE_SSO_SECRET`** — 32-byte random, shared verbatim with the quote app (added to both Vercel projects).
2. **New helper `lib/quote-sso.ts`** — server-only. Exports `signQuoteAccessToken({ email, quoteId })` that returns a JWT signed with `QUOTE_SSO_SECRET` using `jose` (HS256), `iss: "airvues-ops"`, `aud: "airvues-quote"`, `exp: now + 10 minutes`, `sub: email`, `quoteId` claim.
3. **`lib/pipeline.ts` (line 212 area)** — stop hardcoding the URL. Instead, expose a helper `buildWebQuoteUrl(quote)` (or compute in the page) that appends `&sso=<jwt>` when the quote has a `Prepared For` email. Keep the base URL working without the token for legacy links.
   - Because URL construction now needs a signed token, it moves from a plain string on the row to something built at render time in the server component. Two callers only: `app/(app)/pipeline/[id]/page.tsx` and `components/pipeline/QuoteSheet.tsx` (drawer). Both are server-rendered or receive server-prepared props — safe to sign per-render.
4. **Token is short-lived (10 min)** so a shared link doesn't become a permanent bypass, but long enough to survive a normal click → open flow.

No schema, no auth model, no mutation changes.

## Instructions to give the quote app project (airvues-quote)

Tell that project's agent to make these changes:

1. **Add the same `QUOTE_SSO_SECRET` env var** (identical value on both projects, both prod and preview).
2. **Add `jose`** if not already installed.
3. **On the page/route that currently gates the quote behind email entry**, before showing the email form:
   - Read `sso` from the URL search params.
   - If present, verify the JWT with `QUOTE_SSO_SECRET`, enforcing `issuer: "airvues-ops"`, `audience: "airvues-quote"`, and expiry.
   - Confirm the `quoteId` claim matches the `quoteId` URL param (prevents replay against a different quote).
   - On success: set the same session cookie the email-entry flow sets today (same cookie name, same shape) so the rest of the app treats them as authenticated. Then `redirect` to the clean URL with `sso` stripped (avoid leaving the token in browser history / referer).
   - On failure (missing, expired, bad signature, quoteId mismatch): fall through to the existing email-entry form. Do not log the token.
4. **Do not** change the email-entry flow itself — it remains the fallback for direct links, shared links after 10 min, and clients receiving the URL by email.
5. **Rotate the secret** by updating both projects' env vars simultaneously; in-flight tokens (<10 min) become invalid, which is the intended kill-switch.

## Security notes

- Token in URL is acceptable because: it's short-lived, single-purpose (only grants "act as this email on this one quote"), stripped from the URL immediately after redirect, and the referrer risk is limited (the quote app is the destination, not a third-party).
- Do not put the `QUOTE_SSO_SECRET` in any client bundle — both projects use it server-side only (`jose` in a server component / route handler).
- Do not reuse `AUTH_SECRET`; keep this key dedicated so it can be rotated independently.

## Technical checklist

- [ ] `secrets--add_secret` for `QUOTE_SSO_SECRET` (both projects)
- [ ] `lib/quote-sso.ts` (sign)
- [ ] `lib/pipeline.ts` — remove hardcoded `webQuoteUrl`, add builder
- [ ] Update the two call sites to build the URL with the signed token
- [ ] Hand the airvues-quote agent the verify-side spec above
