## Issue

The face preview chip is absolutely positioned at `bottom-4 left-4` inside the recorder card, so it overlaps the tip paragraph and crowds the "Start recording" button. The rest of the New Loop screen is functional but unrefined.

## Fix (presentation only — no logic changes)

### 1. Move the live preview out of the way

In `components/loops/LoopRecorder.tsx`:

- Remove the `absolute bottom-4 left-4` floating chip.
- Insert a dedicated **"Preview · what gets burned in"** panel directly under the face-bubble controls (only rendered when `showPresenceChip` is true). It's an inline row containing:
  - The squircle webcam tile (slightly smaller, ~72px)
  - A short caption stack: name · corner label, plus a faint "Live mirror of bottom-right bubble" helper line and the pulsing red dot when recording.
- The recorder card becomes vertically stacked sections separated by hairline rules: **controls → preview (when on) → status + actions → upload progress → recorded preview → tip**. No more overlap with the tip or buttons.

### 2. Polish the recorder card

- Tighten section spacing (`space-y-5`), use hairline `border-rule/60` dividers between sections instead of relying on `pb-4` hacks.
- Promote the status line ("Ready" / "Recording · 0:12") to a small pill on the left, with a steady mono caps treatment; right side keeps the action buttons.
- Larger, more deliberate primary button styling (still emerald), secondary buttons quieter.
- Add a subtle inner gradient + ring to the card so it feels like a "recorder console" instead of a flat box.

### 3. Polish the surrounding form

In `components/loops/NewLoopForm.tsx`:

- Wrap the Title / Client / Quote block in its own surface card (matching the recorder card) so the screen reads as two clean modules: **Details** and **Recorder**.
- Add small section labels ("Details" / "Capture") above each card in the same mono caps style used elsewhere in the app.
- Inputs/selects: increase vertical padding slightly, add a focus glow consistent with the rest of the app (emerald ring at 30% opacity).

### 4. Page header

In `app/(app)/loops/new/page.tsx` (light touch):
- Keep "New Loop" + tagline, but use the shared `PageHeader` component if already used elsewhere on the loops pages so it matches. If the page uses bespoke markup, leave it but tighten the bottom rule spacing.

## Files touched

- `components/loops/LoopRecorder.tsx` — restructure card sections; move presence chip inline; restyle buttons/status.
- `components/loops/NewLoopForm.tsx` — wrap fields in a surface card, add section labels.
- `app/(app)/loops/new/page.tsx` — verify header matches loops index styling; minor spacing only.

## Out of scope

- No changes to the recording pipeline, canvas compositor, upload flow, server actions, or data model.
- No changes to the face-bubble's burned-in position inside the recording (that's still controlled by the Corner select).
