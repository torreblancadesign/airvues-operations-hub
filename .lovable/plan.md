## Fix: Vercel Blob content-type mismatch on Loop upload

**Root cause**: `MediaRecorder` produces a `Blob` whose `type` is the full MIME with codecs param (e.g. `video/webm;codecs=vp9,opus`). The recorder passes `blob.type` straight through as the upload `contentType`. The upload route's `allowedContentTypes` list contains only base types (`video/webm`, `video/mp4`, ...), and Vercel Blob does an exact-string match — so it rejects anything with a `;codecs=...` suffix.

### Change

In `components/loops/LoopRecorder.tsx`, normalize the content type by stripping the codecs parameter before calling `upload()`:

```ts
const contentType = (blob.type || "video/webm").split(";")[0].trim();
const videoBlob = await upload(videoPath, blob, {
  ...,
  contentType,
});
```

That's the only change needed. The base MIME (`video/webm`) is already in `ALLOWED_MIME` in `app/api/loops/upload/route.ts`, so no server change required.

### Verify

1. Record a short clip in Chrome → confirm upload completes and Airtable row appears.
2. Open `/loops/[id]` → confirm video plays back.

### Not changing

- Server allow-list (already correct for base types).
- Recorder mime selection (vp9/opus is still the encoding choice; only the upload header is sanitized).
