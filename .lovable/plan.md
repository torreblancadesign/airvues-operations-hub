## Goal

Make the AI transcription failure visible in the UI so we can see exactly where it breaks (missing key, video fetch failed, video too large, gateway 4xx/5xx, non-JSON response, etc.) — without poking around in Vercel logs.

## Approach

Right now `analyzeLoopInBackground` swallows errors into `console.warn` and the loop detail page just shows an empty AI summary. We'll capture the failure reason into a new Airtable field and surface it in the UI behind an admin-only debug panel.

### 1. Airtable: add one field
- Table: `Recordings`
- New field: **`Debug Status`** (Long text)
- Stores either `OK` + timing info, or the exact error reason (e.g. `LOVABLE_API_KEY missing`, `video too large (32MB)`, `AI gateway 401: ...`, `non-JSON content`).

### 2. `lib/transcribe.ts` — return structured result instead of throwing/empty
- Change `analyzeLoop` to return `{ analysis, debug }` where `debug` is a string log of: key present? video bytes, mime, gateway status, parse outcome, elapsed ms.
- Never throw; always return a debug string so we capture *something*.

### 3. `lib/loops.ts` + `lib/loops-types.ts`
- Add `debugStatus: string | null` to the `Loop` type and `toLoop` mapper.
- Add `"Debug Status"` to `FIELDS`.

### 4. `lib/mutations/loop.ts`
- `analyzeLoopInBackground` and `regenerateLoopAnalysis` write the `debug` string to `Debug Status` on every run (success or failure), with a timestamp prefix.

### 5. `app/(app)/loops/[id]/page.tsx` — admin-only debug panel
- When `isAdmin` (or owner), render a collapsible `<details>` block titled "🔧 Debug (transcription)" showing `loop.debugStatus` in monospace.
- Also show a small inline badge next to "AI summary" header: green "OK" / red "Failed" / gray "Pending" based on whether `debugStatus` starts with `OK` / contains `failed`/`error` / is null.
- The existing "Regenerate" button already triggers re-analysis — after it runs, the debug panel will reflect the latest attempt.

### 6. Optional quick win
- Log `LOVABLE_API_KEY` *presence + length* (not the value) at the top of `analyzeLoop` so we can confirm Vercel injected it. Example debug line: `key: present (len=180)` or `key: MISSING`.

## What this gives us

After you click "Regenerate" on any loop, the page will show one of these in the debug panel:
- `key: MISSING` → Vercel env var still not wired
- `key: present (len=180) | video: 4.2MB video/webm | gateway: 401 ...` → key is wrong/rotated/not authorized
- `key: present | video: 38MB` → video exceeds the 20MB inline cap (real failure mode, needs a different transcription path)
- `key: present | gateway: 200 | parse: non-JSON ...` → model returned prose instead of JSON
- `OK | 14.2s` → it worked

## Cleanup later

Once we know the failure mode, we'll either fix it and remove the debug panel + `Debug Status` field, or convert the panel into a permanent "Last analysis status" indicator. Files to revert are scoped to: `lib/transcribe.ts`, `lib/loops.ts`, `lib/loops-types.ts`, `lib/mutations/loop.ts`, `app/(app)/loops/[id]/page.tsx`.

## Before I start

One thing I need you to do: in Airtable → `Recordings` table, add a **Long text** field named exactly `Debug Status`. Confirm when done and I'll implement the rest.