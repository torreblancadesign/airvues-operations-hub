
# Airvues Loops — Internal Screen Recorder (MVP)

A browser-native screen+mic recorder that uploads to Vercel Blob, stores metadata in Airtable, and produces unguessable public share links. No installs, no Loom seats.

## Scope (locked from your answers)

- **Lean MVP**: record → upload → list → share. No webcam bubble, no trim, no transcription.
- **Anyone on team records**; share URLs are public (token-protected).
- **Optional record linking** to Clients, Quotes, Stories, or Leads.
- **Retention**: forever, manual delete only.

## User flow

1. User opens `/loops` (new page in sidebar under "Personal" group).
2. Clicks **"New recording"** → modal asks for title + optional link (Client/Quote/Story/Lead via existing picker).
3. Clicks **Start** → browser prompts to pick screen/window/tab and grants mic. Recording starts. Floating timer + stop button.
4. Clicks **Stop** → preview the recording, confirm or discard.
5. On confirm → uploads directly to Vercel Blob (chunked, progress bar) → metadata row created in Airtable → user lands on `/loops/[id]` with the player + share URL ("Copy link" button).
6. The share URL `/r/[token]` is a public, unauthenticated page with the video player, title, and Airvues branding. No nav, no login.
7. On `/loops`, user sees a grid of their recordings; admins/leads see everyone's. Each card: thumbnail (first-frame poster), title, duration, date, linked record badge, "Copy link", "Delete".
8. Linked records (e.g. a Client page) get a small "Recordings" section listing any loop attached to that record.

## Technical design

### Recording (client component)

- `navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true })` for screen + system audio.
- `navigator.mediaDevices.getUserMedia({ audio: true })` for mic, mixed into the recorded stream via `AudioContext`.
- `MediaRecorder` with `video/webm;codecs=vp9,opus`, 2.5 Mbps target, 1s timeslice → array of Blobs.
- On stop: concat into one Blob, generate poster frame via `<video>` + `canvas` toBlob.
- Browser support gate: detect `getDisplayMedia`; show "Use desktop Chrome, Edge, or Firefox" message on unsupported.

### Upload

- Reuse the **Vercel Blob client-upload pattern** already used by `app/api/leads/upload/route.ts` and `app/api/quotes/upload/route.ts`.
- New route: `app/api/loops/upload/route.ts` — mints token, restricts path to `loops/<recordingId>/video.webm` and `loops/<recordingId>/poster.jpg`, gated by `requireRole("admin","lead","engineer","editor")`.
- Max size: bump to 2 GB (covers ~90 min at 2.5 Mbps). Allowed MIME: `video/webm`, `image/jpeg`.
- Client uses `@vercel/blob/client` `upload()` for direct-to-Blob streaming (bypasses Vercel's 4.5 MB body cap).

### Storage — new Airtable table

**`Recordings`** table (user creates in Airtable; we register in `lib/schema.ts`):

| Field | Type | Notes |
|---|---|---|
| Title | singleLineText | |
| Owner | linkedRecord → People | auto-set from session |
| Created | createdTime | |
| Duration (s) | number | from MediaRecorder |
| Video URL | url | Vercel Blob URL |
| Poster URL | url | Vercel Blob URL |
| Size (MB) | number | |
| Share Token | singleLineText | 32-char random, indexed, unique |
| View Count | number | incremented on `/r/[token]` GET |
| Linked Client | linkedRecord → Companies | optional |
| Linked Quote | linkedRecord → Quotes | optional |
| Linked Story | linkedRecord → Stories | optional |
| Linked Lead | linkedRecord → Leads | optional |
| Deleted | checkbox | soft-delete flag |

### Server code

- **`lib/loops.ts`** — `listRecordingsForUser(userId)`, `listAllRecordings()`, `getRecordingByToken(token)`, `getRecordingById(id)`. Cached reads via `listRecordsCached` with `["loops"]` tag.
- **`lib/loops-types.ts`** — client-safe `Recording` type.
- **`lib/mutations/loop.ts`** — `createRecording({title, blobUrl, posterUrl, duration, size, link})`, `deleteRecording(id)` (soft-delete + Blob purge), `incrementViewCount(id)`. Each calls `requireRole` (engineer+ for create/delete; public for view increment via `/r/[token]` route).
- **`lib/schema.ts`** — add `Recordings` table block.
- **`lib/nav.ts`** — add `{ href: "/loops", label: "Loops", group: "personal", showInSidebar: true }`.

### Pages

- `app/(app)/loops/page.tsx` — grid of recordings (user's own; admin/lead see all).
- `app/(app)/loops/[id]/page.tsx` — detail: player, metadata, share URL, copy button, delete button (owner/admin only), linked record chip.
- `app/r/[token]/page.tsx` — **public** route, NOT inside `(app)`, no auth gate. Renders `<video controls poster>`, title, "Recorded by [Owner]", small Airvues wordmark footer. Fires view-count increment.
- Player: native `<video controls>` is sufficient for MVP; no custom controls.

### Security

- Share token: 32 chars from `crypto.randomBytes(24).toString("base64url")`. Unguessable.
- Blob URLs are also unguessable (Vercel Blob generates random paths) — direct URL is effectively a second token.
- `/r/[token]`: 404 if token not found or recording soft-deleted. No PII beyond title + owner name.
- Upload route checks role and path prefix (mirrors existing leads/quotes upload pattern).
- Delete: soft-delete the Airtable row + `del()` the Blob video + poster.

### Cost estimate

- Blob storage: ~$0.023/GB/month. 100 recordings/mo × 200 MB avg = 20 GB/mo new → year 1 ≈ 120 GB end-state ≈ **$2.80/mo** storage + bandwidth (mostly internal viewing).
- vs Loom Business: $15/seat × 10 seats = **$150/mo**. Pays for itself many times over.

## Files to create / change

**New:**
- `app/(app)/loops/page.tsx`
- `app/(app)/loops/[id]/page.tsx`
- `app/r/[token]/page.tsx`
- `app/api/loops/upload/route.ts`
- `components/loops/LoopRecorder.tsx` (client component — MediaRecorder logic)
- `components/loops/LoopCard.tsx`
- `components/loops/LoopPlayer.tsx`
- `components/loops/NewLoopModal.tsx`
- `components/loops/RecordingLinkPicker.tsx` (wraps existing pickers)
- `lib/loops.ts`
- `lib/loops-types.ts`
- `lib/mutations/loop.ts`

**Edit:**
- `lib/schema.ts` — register `Recordings` table + fields
- `lib/nav.ts` — add `/loops` entry
- `lib/uploads.ts` — export `VIDEO_MAX_BYTES = 2GB` constant for the loops route (don't change existing 25 MB cap for leads/quotes)
- `components/clients/ClientSheet.tsx`, `components/pipeline/QuoteSheet.tsx`, `components/engineering/StorySheet.tsx`, `components/leads/LeadSheet.tsx` — small "Recordings" section listing loops linked to that record (read-only, link out to `/loops/[id]`)

## Manual steps you'll need to do

1. **Create `Recordings` table in Airtable** with the fields above (I'll provide exact field names + types to paste). I'll then register the IDs in `lib/schema.ts` — you give me the field IDs via the meta API or I script it.
2. **Confirm `BLOB_READ_WRITE_TOKEN`** is set in Vercel (already is, since leads/quotes upload uses it).

## Out of scope (deliberately deferred)

- Webcam bubble overlay
- In-browser trim/edit
- Transcription / AI summary / chapters
- View analytics beyond a simple count
- Password-protected or expiring share links
- Mobile recording (browser API doesn't exist)
- Auto-delete / retention policy
- CDN signed URLs (Blob URLs are unguessable; revisit if abuse appears)

## Verification

- `npx tsc --noEmit` + `npm run build` clean.
- Record a 30-second clip in Chrome → confirm upload, Airtable row, share URL works in an incognito window.
- Delete the clip → confirm soft-delete (row hidden, share URL 404s, Blob purged).
- Link a clip to a Client → confirm it appears in that Client's sheet.

## Risks to flag now

- **Safari**: can record screen + mic but **not system audio**. Acceptable for MVP; we'll show a one-line note on the recorder.
- **Long recordings**: a 1-hour 1080p clip can hit ~400 MB. Chunked direct-to-Blob upload handles it but the user needs a stable network. We'll show upload progress and let them retry.
- **Browser tab close mid-recording** loses the recording. We'll warn via `beforeunload` while recording.
