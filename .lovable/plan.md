## Problem

`lib/transcribe.ts` inlines the whole video as base64 into a single Gemini chat completion and hard-caps at 20 MB. An 8-minute screen recording easily exceeds that, so analysis fails with `video too large` in Debug Status. We need to support recordings up to ~20 minutes without blowing past gateway limits.

## Root cause

Two stacked constraints:
1. **Inline data ceiling** — the Lovable AI Gateway's `image_url`/inline-data path tops out around 20 MB per request. Video at screen-recording bitrates hits this in 3–5 minutes.
2. **We send the full video** even though 99% of the signal we care about (transcript, summary, action items, questions) is in the **audio track**. Video frames are only marginally useful for a "what did they say" summary.

## Approach: audio-only pipeline

Extract the audio track server-side, transcode to a compact mono Opus/MP3, and send **that** to Gemini instead of the video. Audio at 32 kbps mono is ~240 KB/min, so 20 minutes ≈ 5 MB — comfortably under the 20 MB inline cap with headroom for the JSON response.

We keep the existing single-call Gemini flow (no webhook plumbing, no job polling), just swap the payload.

### Pipeline

```text
Blob video URL
   │
   ▼
fetch() stream  ──►  ffmpeg (audio-only, mono, 32kbps Opus in WebM)
   │                          │
   │                          ▼
   │                   small audio Buffer  (≤ ~6 MB for 20 min)
   │                          │
   ▼                          ▼
fall back to video    Gemini 2.5 Flash  (audio inline-data + same prompt)
if extraction fails           │
                              ▼
                     transcript + 4 sections
```

### ffmpeg on Vercel

This project runs on Vercel Node serverless (not Cloudflare Workers), so a static ffmpeg binary works. Use `ffmpeg-static` (ships a prebuilt binary, ~25 MB, well within Vercel's 250 MB lambda budget) and spawn it via `child_process`, piping the blob download into stdin and reading the Opus/WebM output from stdout — no `/tmp` writes needed.

Add `ffmpeg-static` to the function's `includeFiles` in `next.config.js` (or a `vercel.json` `functions` block) so the binary gets bundled into the lambda.

### New caps

- **Audio path:** raise `MAX_BYTES` to ~18 MB on the extracted audio (covers ~25 min at 32 kbps mono — comfortable margin for 20 min target).
- **Source video:** allow up to ~500 MB download (we only stream it through ffmpeg, never hold it in memory; ffmpeg discards video frames on the fly with `-vn`).
- **Hard timeout:** the route already runs as a Server Action invoked via `waitUntil()` from `createLoop`, so it isn't bound to the upload's request lifetime. Bump the function's `maxDuration` in the route config to 300s to cover long downloads + extraction + Gemini round-trip.

### Failure modes & fallbacks

- If `ffmpeg` spawn fails (missing binary, unexpected platform) → log to `Debug Status` and fall through to the **existing** video-inline path with the current 20 MB cap. No regression for short recordings.
- If audio extraction succeeds but Gemini still returns non-JSON → same `extractJson` fallback already in place.
- If the source video is >500 MB → record `Debug Status` explaining the cap; do not retry.

## Changes

1. **`package.json`** — add `ffmpeg-static` dependency.
2. **`lib/transcribe.ts`**
   - New `extractAudio(videoUrl): Promise<{ data: Buffer; mime: string } | null>` helper that spawns the bundled ffmpeg with `-i pipe:0 -vn -ac 1 -b:a 32k -f webm -c:a libopus pipe:1`, streams the fetched video into stdin, and buffers stdout.
   - `analyzeLoop()` tries audio extraction first; on success, sends the audio buffer to Gemini with `mime_type: "audio/webm"`. On failure, logs the reason and falls back to the current video-inline path.
   - Bump `MAX_BYTES` to 18 MB; add `MAX_VIDEO_DOWNLOAD_BYTES = 500 MB`.
   - Keep the same prompt and JSON contract — no schema changes.
3. **`next.config.js`** — add `outputFileTracingIncludes` for the loops mutation entry so the ffmpeg binary is bundled into the serverless function.
4. **Server Action route hint** — declare `export const maxDuration = 300` on the loop-creation entry path (already a `waitUntil`'d background task, so this only affects the background analyzer, not the user-facing upload).

## What does NOT change

- Upload flow, Blob storage, share tokens, view counts, UI components, RLS/role gating, schema.
- The prompt and the 5 returned fields.
- Short videos still work identically (audio path just makes them faster).

## Out of scope (deferred)

- Chunking >20-min recordings into multiple Gemini calls and stitching transcripts.
- Switching to Gemini Files API for true multi-hour uploads.
- Speaker diarization or timestamps.
- A "Regenerate" button on the UI for stuck videos (already exists via `regenerateLoopAnalysis`).
