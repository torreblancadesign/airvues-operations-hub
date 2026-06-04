## Add meeting-recorder help instructions

### Context
The meeting recorder depends on three things the user must get right:
1. Use Google Chrome (or Chromium-based browser).
2. Allow pop-ups for Airvues so the recorder window can open.
3. When Chrome asks what to share, pick the correct **browser tab** (not a window/screen) and tick **"Share tab audio"**.

Currently there is only a one-sentence hint inside the recorder popup. We should make this more visible and easy to follow.

### Changes

#### 1. `/meetings` list page — add a prominent help block
- Insert a collapsible `<details>` / `<summary>` block just under the `PageHeader` on `app/(app)/meetings/page.tsx`.
- Label: "How to record a meeting"
- Content (numbered, concise):
  1. Use **Google Chrome**.
  2. **Allow pop-ups** for this site (the recorder opens in a small popup window).
  3. Click **New recording** or **Join + record** on a Lead.
  4. When Chrome asks what to share, select the **browser tab** with your meeting and make sure **"Share tab audio"** is checked.
  5. Your microphone is captured separately — speak normally.
- Style with existing tokens (`bg-surface`, `border-rule`, `text-ink-muted`, `text-emerald` for emphasis). Keep it collapsed by default so it does not steal real estate.

#### 2. Recorder popup idle state — richer inline checklist
- Replace the current single `<p>` hint in `MeetingRecorder.tsx` (`status === "idle"`) with a similar numbered checklist.
- Keep it compact (small type, inside the same button panel) so it is visible before the user presses **Start recording**.
- Re-use the same wording for consistency.

#### 3. Pop-up blocked messages — minor copy polish
- In `JoinAndRecordButton.tsx` and `NewRecordingButton.tsx`, keep the existing `alert(...)` but tweak the text to explicitly mention Chrome: "Pop-up was blocked. Please allow pop-ups for this site in **Chrome** so the recorder can open."

### Out of scope
- No new dependencies.
- No backend changes.
- No changes to the recording logic, transcript generation, or lead-linking UI.

### Verification
- `npx tsc --noEmit`
- `npm run build`
- Visual check: confirm the help block is collapsed by default on `/meetings`, and the recorder popup shows the checklist in idle state.