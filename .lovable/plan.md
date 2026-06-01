## Goal

Two additions to the New Loop flow:

1. **Tag recordings to a Client and/or Quote** (skip Lead for now).
2. **Optional webcam "face bubble" overlay** in the bottom-right of the recording — toggleable on/off, with a distinctive Airvues treatment (not a generic Loom copy).

## 1. Client + Quote tagging

The data layer already supports `linkKind: "client" | "quote"` and `linkedId`, but the UI in `NewLoopForm.tsx` hard-codes both to `null`. We extend the form, not the schema.

**Schema change — none.** The `Recordings` table in Airtable already has `Linked Client` and `Linked Quote` fields per the original setup. `createLoop` already writes them via `linkFieldFor()`.

**Limitation in current data shape:** `LoopCreateInput.linkKind` is a single value, but the user wants *both* a client and a quote on the same recording. We expand:

- Update `LoopCreateInput` (in `lib/loops-types.ts`) to accept `linkedClientId: string | null` and `linkedQuoteId: string | null` (both optional, both can be set).
- Update `createLoop` in `lib/mutations/loop.ts` to write both `Linked Client` and `Linked Quote` independently when present. Drop the single `linkKind`/`linkedId` codepath for new writes (keep the type around for the existing `Loop` read shape until we expand it too).
- `LoopRecorder` props change: replace `linkKind`/`linkedId` with `linkedClientId`/`linkedQuoteId`.

**UI in `NewLoopForm.tsx`:**

- Add two native `<select>` pickers above the recorder: "Client" and "Quote", each with a leading "— None —" option. Use `lib/clients.ts` `listAllClients()` and `lib/quotes-light.ts` `listQuoteOptions()` as data sources.
- Since `NewLoopForm` is a client component and these are server-only fetchers, fetch the options in `app/(app)/loops/new/page.tsx` (server component) and pass `clients` + `quotes` arrays as props.
- Selecting a Quote does NOT auto-fill the Client — they're independent (keeps things simple; user can pick both).

## 2. Webcam face bubble overlay

A toggleable circular webcam composite, embedded INTO the recorded video (so it shows up for viewers, not just live).

**Approach — composite via Canvas, not just a UI overlay:**

The webcam needs to be burned into the recorded file. Pure CSS positioning would only show on the recorder's screen. We render screen + webcam together to a `<canvas>`, then capture the canvas via `canvas.captureStream()` and feed THAT into the `MediaRecorder` instead of the raw display stream.

**Recorder changes (`LoopRecorder.tsx`):**

- Add a toggle UI above "Start recording": `[ ] Show my face` with a small live-preview thumbnail once enabled, plus a "Camera position" select (bottom-right / bottom-left / top-right / top-left — default bottom-right).
- When toggle is ON at start time:
  1. Request `getUserMedia({ video: true, audio: true })` for the webcam (separate from the mic-only call, since we now need video too).
  2. Get the display stream as today.
  3. Create a `<canvas>` sized to the display video dimensions. In a `requestAnimationFrame` loop, draw the display video full-frame, then draw the webcam in a circular clipped region in the chosen corner.
  4. Use `canvas.captureStream(30)` as the recorder's video source. Audio mix stays the same (display audio + mic via AudioContext).
  5. Stop the rAF loop and webcam stream on `recorder.onstop` / cleanup.
- When toggle is OFF: behave exactly as today (no canvas, no extra getUserMedia for video).

**Distinctive Airvues treatment (not a Loom clone):**

- Hexagonal-rounded mask instead of a perfect circle — soft squircle (`borderRadius` ~30% via canvas clip path) so it reads as deliberate, not default.
- Thin emerald ring around the bubble (1.5px, `#22D3A8` at ~70% alpha) with a subtle outer glow (8px shadow, same emerald at ~25% alpha). Matches the brand accent already used on login + public share page.
- Tiny mono caption *underneath* the bubble in the burned video: the owner's first name (resolved client-side from a prop we pass from the page). E.g. "BLAKE" in 10px JetBrains Mono, letter-spaced. This is the "uniqueness" — a labeled presence, not an anonymous floating head.
- Default size: 18% of the shorter video dimension (so it scales with display resolution). Capped at 240px.
- Smooth fade-in over the first ~400ms of recording (canvas alpha ramp) so the bubble doesn't pop in jarringly.

**Live preview while recording:** The `<canvas>` itself isn't shown to the user; the existing `previewUrl` video after stop already plays back the composited result. We do show a small webcam preview tile in the toggle row so the user can frame themselves before hitting Start.

## File changes

- **`lib/loops-types.ts`** — add `linkedClientId` / `linkedQuoteId` to `LoopCreateInput`. Keep `linkKind`/`linkedId` on the `Loop` read type for now (separate concern).
- **`lib/mutations/loop.ts`** — `createLoop` writes both `Linked Client` and `Linked Quote` independently.
- **`components/loops/NewLoopForm.tsx`** — accept `clients` and `quotes` props, render two pickers + face-bubble toggle/camera-position select, pass selections + `webcamEnabled`/`webcamPosition`/`ownerFirstName` to `LoopRecorder`.
- **`components/loops/LoopRecorder.tsx`** — accept new props; when webcam enabled, build canvas compositor pipeline; otherwise keep current screen-only path. Add webcam preview tile.
- **`app/(app)/loops/new/page.tsx`** — server-fetch `listAllClients()` + `listQuoteOptions()` + resolve session user's first name; pass into `NewLoopForm`.

## What does NOT change

- No Airtable schema changes (Linked Client + Linked Quote fields already exist).
- No changes to public share page, upload route, delete flow, or view counting.
- No Lead linking (explicitly deferred per the request).
- The `Loop` read type's `linkKind`/`linkedLabel` stays single-valued for now — list views still show one primary link. We can expand to show both later if needed; out of scope here.

## Verification

- `npx tsc --noEmit` + `npm run build` clean.
- Record with face OFF → behaves like today, no webcam permission prompt.
- Record with face ON → browser asks for camera; composited video shows bubble in chosen corner with emerald ring + name caption; playback in `/loops/[id]` and `/r/[token]` both show the burned-in bubble.
- Pick a Client and a Quote → confirm Airtable row has both link fields populated.
- Pick neither → recording saves with no link fields (current behavior preserved).
