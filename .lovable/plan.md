
# Fix face bubble: live preview, placement, smoothness

Three targeted fixes to `components/loops/LoopRecorder.tsx`. No other files change.

## 1. Live preview while recording

Today the webcam only renders into the off-screen `<canvas>` that feeds the recorder, so the user sees nothing until playback. Fix:

- Keep the existing camera preview `<video>` element visible **during** the `recording` state, not just while idle.
- Render it as a small floating "presence chip" pinned in the **bottom-left of the recorder card** (not over the shared screen — the browser doesn't let us overlay the OS share surface anyway). It mirrors what's being burned in: same squircle mask, emerald ring, soft glow, corner label ("BR / BL / TR / TL"), and live caption.
- Keep the same `MediaStream` alive across idle → recording (today it tears down and the cam track in `start()` is a separate request). Reuse `camPreviewStream` as the single source for both the preview `<video>` and the canvas compositor, so there's only one webcam stream and the preview never blanks.

## 2. Placement above the browser share bar

Chrome/Edge overlay a "Stop sharing" bar at the bottom-center that visually clips a bottom-right bubble. Fix:

- Increase the bottom margin for `br` / `bl` corners from `bubbleSize * 0.22` to a **fixed safe-area offset** (`max(bubbleSize * 0.22, 96px)`) so the bubble always sits above the share bar.
- Rename the corner labels in the picker to make this explicit: "Bottom right (above share bar)" / "Bottom left (above share bar)".
- Top corners keep the small margin.

## 3. Smoother face video

Current pipeline draws every RAF tick at the full display resolution (often 2560×1440 or 3840×2160), which can starve the encoder and produce the choppy/slow feel. Fix:

- **Cap compositor canvas to 1920×1080** (preserve aspect ratio of the actual display track). Most share sources are larger than needed for a 2.5 Mbps recording; downscaling once per frame is far cheaper than encoding 4K.
- **Drive the draw loop from the display video**, not RAF, using `HTMLVideoElement.requestVideoFrameCallback` when available (Chrome/Edge/Safari). This produces one composite per real source frame, eliminating duplicated/missed frames. Fall back to RAF on Firefox.
- **Lower webcam capture resolution** to `320×320` (we only render at ~240px max). Big reduction in per-frame `drawImage` cost.
- **Bump recorder framerate hint** to match: `canvas.captureStream(24)` and align the `videoBitsPerSecond` to `3_000_000` so motion has enough headroom.
- Add a one-time warning toast if the resulting recorder framerate drops below ~15fps (using `recorder.requestData` interval as a proxy is unreliable; we'll skip the toast if it adds complexity — primary fix is the resolution cap + rVFC).

If after these changes the face still feels choppy on the user's machine, the toggle remains — they can record without the bubble.

## Out of scope

- Public share page, upload route, Airtable schema, tagging logic — all untouched.
- No new dependencies.

## Technical summary

File: `components/loops/LoopRecorder.tsx`
- Hoist `camPreviewStream` to be the single webcam source; don't re-request `getUserMedia` inside `start()`.
- Render the preview `<video>` whenever `faceOn` is true, regardless of `status`. Move it into a small floating chip (`absolute bottom-3 left-3`) with the same squircle / ring / caption styling.
- Compositor: clamp canvas to `min(displayW, 1920) × min(displayH, 1080)` preserving aspect; use `requestVideoFrameCallback` on the display video element with RAF fallback; request webcam at 320×320.
- Bubble position math: `bottomMargin = Math.max(bubbleSize * 0.22, 96)` for `br`/`bl`.
- `canvas.captureStream(24)`, `videoBitsPerSecond: 3_000_000`.
