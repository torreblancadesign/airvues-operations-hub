
## Goal

Let users upload supporting documents from the Lead drawer, in addition to whatever was added in Airtable. Files round-trip into the existing `Attach Supporting Documentations` field on the Lead record.

## Approach

Airtable's REST API only accepts attachments by URL — it then fetches and mirrors the file into its own storage. So we need to host the file somewhere public-readable just long enough for Airtable to grab it. We'll use **Vercel Blob** (native to the existing Vercel deploy).

Upload flow:
```text
Browser ── (1) direct PUT ──▶ Vercel Blob
   │                              │
   │                              └── returns public URL
   │
   └── (2) server action ─▶ Airtable PATCH (append URL to attachment field)
```

Why direct client→Blob (not server-streamed): Vercel serverless has a 4.5 MB request body cap. The official `@vercel/blob/client` flow sidesteps that and supports up to 5 GB.

## One-time setup you'll do

In Vercel → Storage → Create Blob Store → it auto-populates `BLOB_READ_WRITE_TOKEN` in the project env. I'll flag this clearly when shipping; the mutation throws a friendly "Blob store not configured" error until it's there.

## Scope

- Drag-and-drop + click-to-pick uploader inside the existing Attachments block on `LeadSheet`.
- Multi-file uploads with per-file progress + error states + cancel.
- Limits: **25 MB per file**, **10 files per batch**, common doc/image types (pdf, png, jpg, jpeg, webp, gif, doc, docx, txt, csv, xls, xlsx, ppt, pptx, mp4, mov).
- Appends to existing attachments — never replaces.
- Optimistic UI: newly-uploaded items appear immediately, reconciled with Airtable's response (which includes the real `id`, `size`, `type`, thumbnails).
- Gated on the existing `canEdit` (admin / lead / editor). Engineers + clients see view-only list.

Out of scope: deleting attachments, inline previews, applying the same uploader to stories. Easy follow-ups.

## Changes

### 1. `package.json`
Add `@vercel/blob`.

### 2. `app/api/leads/upload/route.ts` (new)
Server route that wraps `@vercel/blob/client`'s `handleUpload`. It:
- Calls `requireRole("admin", "lead", "editor")` — uploads are auth-gated.
- Validates `leadId` exists, filename, contentType against allowlist, size ≤ 25 MB.
- Returns a short-lived client token scoped to pathname `leads/{leadId}/{timestamp}-{sanitized-filename}`.
- `onUploadCompleted` callback is a no-op (we handle the Airtable PATCH from the client after upload, so we get the response back).

### 3. `lib/mutations/lead.ts` — add `attachLeadFiles`
```ts
attachLeadFiles({ leadId, files: [{ url, filename }] })
```
- `requireRole("admin", "lead", "editor")`, zod validation.
- Reads current `Attach Supporting Documentations` array from the Lead, appends new `{url, filename}` entries.
- `patchRecords(Tables.Leads.id, …)` using the field ID from `Tables.Leads.fields["Attach Supporting Documentations"].id`.
- Returns the rehydrated attachment objects from Airtable's response so the UI can swap in real ids/sizes/types.
- `revalidateTag("airtable")` + `revalidateTag("leads:all")`.

### 4. `components/leads/LeadSheet.tsx`
Extend the existing `Attachments` component:
- Keep the read-only list at top.
- Below, when `canEdit`, render a drop zone (`<div>` with `onDragOver` / `onDrop` + hidden `<input type="file" multiple>`).
- On file select: call `upload()` from `@vercel/blob/client` with `handleUploadUrl: "/api/leads/upload"` and lead context in `clientPayload`. Each upload returns a `PutBlobResult` with the public URL.
- After all in-batch uploads succeed, call `attachLeadFiles` once with the full set, then swap optimistic rows for the real attachments.
- Per-file row shows: icon, filename, progress bar (driven by `onUploadProgress`), cancel button, error + retry on failure.
- Match the existing `useTransition` pattern from `StatusEditor` / `TranscriptEditor`.

### 5. Docs
Add a one-liner to `HANDOVER.md` under env vars: `BLOB_READ_WRITE_TOKEN` (auto-set when Blob store is created in Vercel).

## Technical Notes

- **Pathname**: `leads/{leadId}/{Date.now()}-{sanitizedFilename}` keeps things grouped + collision-free. `addRandomSuffix: false` because the timestamp prefix already disambiguates.
- **Filename sanitization**: keep alphanumerics, `.`, `_`, `-`; strip everything else; cap at 200 chars before the timestamp prefix. Display name preserved in Airtable's `filename` field.
- **MIME allowlist** enforced both client-side (immediate UX) and server-side in `handleUpload` (security).
- **Orphan blobs**: if blob upload succeeds but the Airtable PATCH fails, the blob is left in the bucket. Acceptable for now; documented in code. A cleanup cron is a later concern.
- **No schema changes** to `lib/leads.ts` — the `attachments` array type already exists.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. Local: with `BLOB_READ_WRITE_TOKEN` set, sign in as admin → open lead → drop a 15 MB PDF + a PNG → progress bars complete → list updates → refresh → both still there → check Airtable web UI → files present.
4. Drag a 30 MB file → rejected client-side with clear message.
5. Drag a `.exe` → rejected client-side.
6. Sign in as engineer → drop zone hidden, existing files still listed + downloadable.
7. Curl `/api/leads/upload` unauthenticated → 401/403.
