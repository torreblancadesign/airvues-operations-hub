## Problem

When you toggle "Show my face" on, the webcam LED briefly turns green then goes dark. The browser granted permission — the app is stopping its own stream.

## Root cause

In `components/loops/LoopRecorder.tsx`:

```tsx
const stopCamPreview = useCallback(() => {
  camPreviewStream?.getTracks().forEach((t) => t.stop());
  setCamPreviewStream(null);
}, [camPreviewStream]);

useEffect(() => () => stopCamPreview(), [stopCamPreview]);
```

The "unmount cleanup" effect actually re-runs on every render where `stopCamPreview`'s identity changes — which is every render where `camPreviewStream` changes. The first state change after enabling the bubble triggers the previous render's cleanup, which calls the stale `stopCamPreview` and sets the stream to null. The next render's cleanup then calls the version closed over the real stream and stops every track. Camera dies. The chip's `<video>` shows black forever after.

## Fix

Rewrite the lifecycle so:

1. `stopCamPreview` no longer reads `camPreviewStream` from closure. Track the live preview stream in a ref (`camPreviewStreamRef`) that's kept in sync via a tiny effect, and have `stopCamPreview` read from the ref. This makes the callback stable (`useCallback(..., [])`).
2. Remove the bogus `useEffect(() => () => stopCamPreview(), [stopCamPreview])` and replace it with a true unmount-only effect: `useEffect(() => () => { /* stop tracks via ref */ }, [])`.
3. The existing `disableFace` button and the `start()` re-use path continue to work because they still call `stopCamPreview` / read `camPreviewStream` directly.

Also keep the `srcObject` attach effect (`camPreviewRef.current.srcObject = camPreviewStream`) — that part is correct.

## File touched

- `components/loops/LoopRecorder.tsx` — refactor `stopCamPreview` + cleanup effects only. No UI/markup changes, no changes to the recording pipeline, canvas compositor, or upload flow.

## Verification

- Enable "Show my face" → webcam LED stays on, preview chip shows live feed.
- Toggle face off → LED turns off, chip disappears.
- Toggle on, start recording, stop → preview kept alive between sessions (existing behavior preserved).
- Navigate away from the page → tracks stopped (no orphan camera light).
- `npx tsc --noEmit` and `npm run build` clean.
