## Problem

Audio drifts behind video in recorded loops — lips don't match voice.

## Root cause (in `components/loops/LoopRecorder.tsx`)

1. `canvas.captureStream(24)` runs a 24fps auto-capture timer decoupled from when we actually draw frames. Video frames get timestamped by the canvas capture clock, audio by its real clock. They walk apart.
2. Even when there's only one audio source (just mic OR just display audio), we route it through an `AudioContext` + `MediaStreamDestination`. That graph adds buffering latency that pushes audio behind video.

## Fix (in `components/loops/LoopRecorder.tsx`, `start()` only)

### 1. Drive canvas frames manually

- Change `canvas.captureStream(24)` → `canvas.captureStream(0)` (no auto-capture).
- After `drawFrame()` inside the rVFC and rAF tick, call `requestFrame()` on the canvas stream's video track (cast to `CanvasCaptureMediaStreamTrack`).
- Every emitted video frame is now timestamped at draw time, so the muxer aligns video against matching audio timestamps. Lip-sync is preserved.

### 2. Skip the audio mixer when nothing to mix

- If both `displayAudio.length > 0` AND `mic` exist → keep the AudioContext mixing path (genuinely need to combine two sources).
- Otherwise pass the single source's audio track directly into the combined `MediaStream` and do NOT create an `AudioContext`. Eliminates the mixer's buffering latency in the common case.

### 3. Belt-and-suspenders

- Lower `recorder.start(1000)` → `recorder.start(250)` so the muxer flushes smaller chunks.
- Pass `{ latencyHint: "interactive" }` to the `AudioContext` constructor in the path where mixing IS required.

## File touched

- `components/loops/LoopRecorder.tsx` — `start()` only. No UI changes, no data/API changes, no changes to the face-bubble draw logic itself.

## Verification

- Record a 30s clip; confirm lip/voice alignment at start, middle, and end.
- Face bubble still renders correctly (manual `requestFrame` after every draw).
- `npx tsc --noEmit` + `npm run build` clean.

## Out of scope

- Switching encoder/container/codecs.
- Changing the capture architecture (still canvas-composite when face is on, still passthrough display track when face is off).
