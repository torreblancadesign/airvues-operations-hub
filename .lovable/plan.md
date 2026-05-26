## Confirmed facts

- `BLOB_READ_WRITE_TOKEN` is set in Production (`hasToken: true, looksValid: true`).
- `@vercel/blob` 2.4.0 is installed. Its default API URL really is `https://vercel.com/api/blob` — that part is **not** wrong.
- Client code in `components/leads/LeadSheet.tsx` calls `upload(pathname, file, { handleUploadUrl: '/api/leads/upload', clientPayload: ..., access: 'public', contentType: ... })` — textbook correct.
- The SDK's `upload()` always POSTs to `handleUploadUrl` first to retrieve a client token, then PUTs the file. No bypass path exists.

## The actual symptom

The PUT to `https://vercel.com/api/blob/?pathname=...` returns **400 Bad Request** with no CORS headers. The browser then surfaces it as a CORS error, but the underlying problem is the 400. A 400 from the Blob API on that endpoint almost always means **the Authorization header is missing or invalid** — i.e. the client never received a usable `clientToken` from `/api/leads/upload`.

You reported you don't see the POST to `/api/leads/upload` in DevTools. That's either (a) a filter/preserve-log issue, or (b) the POST is being blocked client-side before it leaves the browser. Either way, we need ground-truth instrumentation.

## Step 1 — Add client-side breadcrumbs to `LeadSheet.tsx`

Wrap the `upload()` call so we log:
- Before the call: pathname, lead.id, file name/size.
- The native `fetch` request and response status for `/api/leads/upload` — done by temporarily monkey-patching `window.fetch` for the duration of the upload, so we capture the SDK's internal POST that the Network tab is missing.
- After: success URL or full error object.

Concretely, in the `onDrop` / upload handler:

```ts
const origFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.toString();
  console.log("[blob] fetch start", init?.method ?? "GET", url);
  try {
    const res = await origFetch(input, init);
    console.log("[blob] fetch end", res.status, url);
    return res;
  } catch (e) {
    console.log("[blob] fetch THREW", url, e);
    throw e;
  }
};
try {
  const blob = await upload(pathname, file, { ... });
  console.log("[blob] upload success", blob);
} catch (e) {
  console.log("[blob] upload FAILED", e);
} finally {
  window.fetch = origFetch;
}
```

This guarantees we see every fetch the SDK makes, in the browser console, regardless of Network tab filtering.

## Step 2 — Reproduce and capture

Push the change. After Vercel redeploys, repeat the file upload and copy the Console output. Three possible outcomes, each with a known fix:

| Console output | Diagnosis | Fix |
|---|---|---|
| `fetch start POST /api/leads/upload` → `fetch end 200` then `fetch start PUT vercel.com/api/blob/` → `fetch end 400` | Token route returns 200 but with wrong shape | Inspect `/api/leads/upload` response body via `console.log` of the `res.json()` to confirm; usually means `handleUpload` wrapper failed silently |
| `fetch start POST /api/leads/upload` → `fetch end 401/403/302` | Auth middleware or Vercel Deployment Protection is blocking the route | Allow the route in `middleware.ts` matcher and/or disable Vercel Authentication for Production |
| `fetch start POST /api/leads/upload` → `fetch THREW ...` | CSP / network policy / service worker | Check Console for CSP report; check `next.config.js` `headers()`; unregister any leftover SW |
| No `fetch start POST /api/leads/upload` at all | Something is intercepting before our code runs (browser extension, SW) | Test in Incognito with extensions off |

## Step 3 — Ship the fix

Based on Step 2's outcome, apply the corresponding fix in one focused edit and remove the diagnostic logging.

## Technical notes

- Monkey-patching `window.fetch` is safe here because it's scoped: we restore the original in `finally`, and the upload completes in a few seconds.
- No need to touch `app/api/leads/upload/route.ts` or `lib/uploads.ts` yet — those look correct. We're proving the client is even reaching them first.
- After fixing, also check `middleware.ts` to see if there's a matcher that includes `/api/*` and unintentionally redirects unauthenticated requests; that's a common Next.js gotcha when adding NextAuth middleware. Even if you're signed in, an auth-cookie SameSite issue can make the POST look unauthenticated.

## What I need from you to proceed

Just say "go" and I'll switch to build mode, add the diagnostic wrapper, and ship it. You then upload one file, paste the Console output, and I push the actual fix.