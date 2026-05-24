## Problem

Clicking certain quotes on `/pipeline` intermittently throws a client-side exception that takes down the whole app shell (whitescreen with Next.js "Application error"). It is random across rows, which means the trigger is a specific quote's field shape, not the click handler itself.

The crash surfaces from inside `QuoteSheetEditor` (mounted by `QuoteSheet`), and right now there is **no error boundary** around the drawer, so any throw inside the editor unmounts the entire `/pipeline` route.

## Likely causes (to confirm with the captured error)

Reading `components/pipeline/QuoteSheetEditor.tsx`:

1. **Unsafe `.trim()` calls in `aiContentReady`** (lines 879–887). They assume `quote.recommendedApproach`, `recommendedApproachSummary`, `projectOverview`, `problemStatementSolution`, `estimateHoursRange`, `estimateCostRange`, `customProblemStatement` are always strings. `lib/quotes.ts` does coerce with `?? ""`, but Airtable rich-text / formula fields occasionally return objects or arrays (e.g. `{ specialValue: "NaN" }` from a broken formula, or a rollup that returns an array). One non-string slips through and `.trim is not a function` throws on render.
2. **`quote.documents` mapped without guard** (`lib/quotes.ts` line 117). If the field is anything other than `null` or `Array`, `.map` throws. Less likely but possible for misconfigured records.
3. **`quote.client.split(" ")[0]`** in `QuoteSheet.tsx` is safe because `client` defaults to `"—"`, but worth hardening.

The exact field is impossible to confirm without the captured error. The fix below makes the drawer crash-proof AND surfaces the real error so we can patch the underlying data path.

## Plan

### 1. Add a contained error boundary around the drawer (`components/pipeline/QuoteSheet.tsx`)

- New small `QuoteSheetErrorBoundary` (client component, classic React class boundary — no extra deps).
- Renders a friendly fallback inside the drawer: title, the error message, "Open in Airtable" link (using the already-known `quote.airtableUrl`), and a "Close" button. Drawer chrome and overlay stay intact; rest of the app stays mounted.
- `console.error(error, info)` so we get a stack trace in the browser console next time it reproduces, instead of just the generic Next.js page.
- Wrap `<QuoteSheetEditor ... />` only — keep the header strip / action buttons outside the boundary so the user can always close or jump to Airtable.

### 2. Harden `aiContentReady` and other string reads in `QuoteSheetEditor.tsx`

- Add a tiny local helper `asStr(v: unknown): string` that returns `typeof v === "string" ? v : ""`.
- Use `asStr(quote.X).trim()` in the `aiContentReady` boolean.
- Use the same helper for `TextField initialValue` props and `AiField value` props on every AI text field. This stops a single bad Airtable value from ever crashing the editor.

### 3. Harden `lib/quotes.ts` normalization

- Wrap the `Documents needed for Proposal` read with `Array.isArray(f["Documents needed for Proposal"]) ? ... : []`.
- For all rich-text-ish fields (`Recommended Approach`, `Recommended Approach Summary`, `Project Overview`, `Problem Statement & Our Solution`, `Estimate Hours Range`, `Estimate Cost Range`, `Custom Problem Statement and Solution Summary`, `Client Notes` on stories), replace the `(f["X"] as string) ?? ""` cast with `typeof f["X"] === "string" ? f["X"] : ""`. This kills the bad-shape class of crash at the source for every consumer of `QuoteDetail`, not just the drawer.

### 4. Verification

- `npx tsc --noEmit` and `npm run build` must pass.
- Manually click through 10+ quotes on `/pipeline` in preview, including older ones that previously crashed, and confirm:
  - Drawer opens without crashing.
  - If a row still hits an unexpected shape, the contained fallback renders and the actual error is now visible in DevTools console — bring that back to investigate the underlying field.

## Out of scope

- No Airtable schema or field changes.
- No mutation-path changes (`lib/mutations/quote.ts` is untouched).
- No redesign of the drawer — purely defensive hardening + an error boundary.
