## Goal

After a Loop is recorded, automatically generate a transcript plus four client-facing sections — **Summary**, **Key Notes**, **Action Items**, **Questions for Client** — and save them to Airtable. Display them on both the internal detail page (`/loops/[id]`) and the public share page (`/r/[token]`).

## Why backend-generated (not Airtable AI fields)

- One Gemini call returns transcript + all four sections as structured JSON → one atomic Airtable write, one cost line, one failure mode.
- Synchronous-ish completion signal (we know when fields are ready and can revalidate the page).
- Prompt lives in our repo → versionable, tweakable, reviewable in PRs.
- Future "Regenerate summary" button is trivial — Airtable AI fields don't really support on-demand re-runs against an edited prompt.
- Airtable AI per-cell costs add up; one Gemini Flash call is cheaper.

## Airtable schema (one-time, manual)

Add five **Long text** fields to the `Recordings` table:

- `Transcript`
- `Summary`
- `Key Notes`
- `Action Items`
- `Client Questions`

After adding, run the schema regenerator so `lib/schema.ts` picks them up.

## Pipeline

```text
LoopRecorder upload  ──►  /api/loops/upload  ──►  createLoop() (Airtable row, fields blank)
                                                          │
                                                          ▼
                                          analyzeLoopInBackground(id, videoUrl)
                                          (fire-and-forget, server-side)
                                                          │
                                  ┌───────────────────────┘
                                  ▼
                       fetch video bytes from Vercel Blob (cap ~20 MB)
                                  │
                                  ▼
                       Lovable AI Gateway → google/gemini-3-flash-preview
                       Prompt: "Transcribe, then produce a client-facing
                                summary, key notes, action items, and
                                questions for the client. Return JSON."
                       response_format: json_object
                                  │
                                  ▼
                       PATCH all 5 fields in one Airtable write
                       revalidateTag(`loops:id:${id}`) + `loops`
```

Properties:
- **Non-blocking**: row appears in `/loops` immediately; the analysis cards fill in on refresh (~15–45s for short clips).
- **Best-effort**: gateway 429/402, oversize file, or parse failures are logged and swallowed; the recording is never rolled back. UI shows a clear "Still processing…" placeholder.
- **Server-only**: `LOVABLE_API_KEY` never leaves the Vercel function.

## Files to change

### 1. `lib/transcribe.ts` (new) — single AI helper

Exposes `analyzeLoop(videoUrl): Promise<{ transcript, summary, keyNotes, actionItems, questions }>`.

- Fetches blob bytes (skip + warn if >20 MB).
- One call to Lovable AI Gateway with `google/gemini-3-flash-preview`, multimodal `inline_data` (video), `response_format: { type: "json_object" }`, and a schema-constrained prompt:
  > "You are summarizing an internal screen recording for a client. Transcribe the spoken audio, then write a concise summary, key notes the client needs to understand, action items the client needs to take, and any questions for the client that came up. Use plain English, no jargon. Return JSON with keys: transcript, summary, keyNotes, actionItems, questions. Each section is a string; use bullet-style lines separated by newlines where appropriate. If a section has nothing to report, return an empty string."
- Validates the JSON shape (Zod). Trims each field. Throws on hard failures.

### 2. `lib/mutations/loop.ts`

- Add `analyzeLoopInBackground(id, videoUrl)` — non-blocking wrapper: calls `analyzeLoop`, then `patchRecords(RECORDINGS_TABLE, [{ id, fields: { Transcript, Summary, "Key Notes", "Action Items", "Client Questions" } }])`, then `revalidateTag(\`loops:id:${id}\`)` + `revalidateTag("loops")`. Try/catch + `console.warn` on failure.
- In `createLoop`, after a successful `createRecords(...)`, fire `void analyzeLoopInBackground(created.id, input.videoUrl)` (no `await`).
- Add `regenerateLoopAnalysis(id)` server action, gated like `deleteLoop` (admin/lead/editor/engineer). Wired to a small "Regenerate" button on the internal detail page.

### 3. `lib/loops.ts` + `lib/loops-types.ts`

- Extend `Loop` type with `transcript | summary | keyNotes | actionItems | questions: string | null`.
- Add the five field names to `FIELDS` and `RecordingRow`.
- Populate them in `toLoop` (`?? null`).

### 4. `app/(app)/loops/[id]/page.tsx` (internal)

Below the video, render an `<AiSummaryPanel>` (new) with four stacked cards in the existing `bg-surface border border-rule rounded-card` family:

```text
┌─ SUMMARY ─────────────────────────────────────┐
│ Plain-English summary…                        │
└───────────────────────────────────────────────┘
┌─ KEY NOTES ───────────────────────────────────┐
│ • …                                           │
└───────────────────────────────────────────────┘
┌─ ACTION ITEMS ────────────────────────────────┐
│ • …                                           │
└───────────────────────────────────────────────┘
┌─ QUESTIONS FOR CLIENT ────────────────────────┐
│ • …                                           │
└───────────────────────────────────────────────┘
```

- If all five fields are empty → single "Generating summary… refresh in a moment." card.
- Section-level empty handling: hide a card if its field is empty *and* at least one other section is populated (means the model intentionally returned nothing for it).
- Below the cards, a collapsible `<details>` with the full transcript (mono font, `whitespace-pre-wrap`).
- A small "Regenerate" link (admin/lead/editor/engineer only) next to the existing delete button — calls `regenerateLoopAnalysis(id)`.

### 5. `app/r/[token]/page.tsx` (public client share page)

Render the same `<AiSummaryPanel>` cards below the video. **Do not** render the transcript or the Regenerate button on the public page — that's internal-only. If the cards are still empty, show nothing (don't expose the "still processing" placeholder to clients).

### 6. `components/loops/AiSummaryPanel.tsx` (new)

Shared between `/loops/[id]` and `/r/[token]`. Props: `{ summary, keyNotes, actionItems, questions, variant: "internal" | "public" }`. The `variant` controls empty-state behavior (placeholder vs hide).

### 7. `components/loops/LoopsBrowser.tsx`

Extend the free-text search predicate to also match `summary`, `keyNotes`, `actionItems`, `questions`, and `transcript`. One-line change in the existing `filtered` memo. Makes "what did we tell them about pricing" findable from the grid.

## Out of scope

- Word-level timestamps / video captions.
- Speaker diarization (would need ElevenLabs).
- Editable summary fields in the UI (you can still edit directly in Airtable; we could add inline editing later).
- Email-the-summary-to-client flow.
- Backfilling existing recordings — only new uploads get analyzed. A one-off script can backfill later if useful.
- Translation / multi-language support.

## Verification

1. `npx tsc --noEmit` and `npm run build` clean.
2. Record a short Loop → row appears in `/loops` instantly → wait ~30s → refresh `/loops/[id]` → four cards populated, transcript visible in the collapsed section.
3. Open the public `/r/[token]` link → see the same four cards, no transcript, no Regenerate button.
4. Search test: type a phrase you said into the Loops search box → recording matches.
5. Regenerate test: click "Regenerate" → cards refresh with a new run.
6. Failure path: temporarily break the gateway (bad model name) → recording still uploads, internal page shows "Generating…" placeholder, public page shows nothing extra, no 500.
7. Confirm the five Airtable cells are populated for the new row.
