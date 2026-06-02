# Meeting Notes — plan

## What we're building

A meeting recorder + AI note-taker that lives at **`/meetings`**, separate from Loops. The flow:

1. From a Lead (or the meetings widget), user clicks **Join meeting**.
2. Two things happen in one click:
   - The Google Meet / Zoom URL opens in a new tab.
   - A small **Recorder popup** (our app, ~420×520) opens, pre-bound to that lead.
3. In the popup the user clicks **Start** → Chrome's screen-share dialog appears → user picks the Meet tab and ticks **"Also share tab audio"**. We capture *tab audio + their mic* and mix them into a single audio track.
4. The popup shows an elapsed timer, level meter, and a **Stop & save** button. Closing the popup mid-call prompts "Discard or save?".
5. On stop: audio uploads to Vercel Blob → creates a `Meetings` row in Airtable → fires a background AI job (transcript + summary + key decisions + action items + follow-up questions) → page revalidates and shows the notes.
6. A manual **New recording** button on `/meetings` does the same flow without a lead pre-bind (lead picker becomes optional after the fact).

Loops stays exactly as-is. This is a sibling feature with its own table, route, recorder, and AI prompt tuned for meetings (internal notes, not client-facing copy).

## Airtable schema (one-time, manual)

New table **`Meetings`** in the same base. Long-text unless noted:

- `Title` (single line) — defaults to lead name + date.
- `Lead` (link → Leads) — single record, optional.
- `Owner` (link → People) — set from session.
- `Created` (createdTime).
- `Duration (sec)` (number).
- `Audio URL` (URL) — Vercel Blob.
- `Audio Size (MB)` (number).
- `Source` (single select: `meet`, `zoom`, `manual`, `other`).
- `Status` (single select: `Processing`, `Ready`, `Failed`).
- `Transcript` (long text).
- `Summary` (long text).
- `Key Decisions` (long text).
- `Action Items` (long text).
- `Follow-up Questions` (long text).

After adding the fields, run the schema regenerator so `lib/schema.ts` picks them up. Add `Meetings` to `Tables.*`.

## Files to add / change

### 1. Recorder (the hard part)

**`components/meetings/MeetingRecorder.tsx`** (client) — uses `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })` for tab audio, plus `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })` for mic, mixes both via a `Web Audio` `MediaStreamAudioDestinationNode`, records with `MediaRecorder` (`audio/webm;codecs=opus`, 64 kbps), keeps a level meter via `AnalyserNode`. Video track is captured but immediately stopped — we only keep audio. Uploads via `@vercel/blob/client` `upload()` to `/api/meetings/upload`, then calls `createMeeting()` server action. Shows clear permission failure states (no system audio checked, user denied, browser unsupported → Firefox/Safari).

**`app/(app)/meetings/recorder/page.tsx`** — minimal chrome (no sidebar/topbar), renders `<MeetingRecorder leadId={…} leadName={…} />`. This is the popup target. Uses a special layout that bypasses `(app)/layout.tsx` shell — implement via a route group `app/(recorder)/meetings/recorder/page.tsx` with its own thin `layout.tsx`. Stays mounted while the user is in the Meet tab.

**`components/meetings/JoinAndRecordButton.tsx`** (client) — replaces / wraps the current "Join meeting" link on the Lead drawer and on the upcoming-meetings widget. On click:
```ts
window.open(meetUrl, "_blank", "noopener");
window.open(`/meetings/recorder?leadId=${leadId}`, "airvues-recorder", "width=420,height=560,popup=yes");
```
If the popup is blocked, falls back to inline drawer recorder on the current page.

### 2. Upload endpoint

**`app/api/meetings/upload/route.ts`** — copy of `app/api/loops/upload/route.ts`. Allowed MIME `audio/webm`, `audio/mp4`, `audio/mpeg`. Path prefix `meetings/${sessionId}/`. Size cap ~50 MB (an hour of 64 kbps opus ≈ 28 MB).

### 3. Data layer

**`lib/meetings-types.ts`** (client-safe) — `Meeting` type and `MeetingCreateInput`.

**`lib/meetings.ts`** (server-only) — `listMeetingsCached()`, `getMeetingCached(id)`, `toMeeting()`. Mirrors `lib/loops.ts` shape and patterns (cached reads tagged `meetings`, `meetings:id:${id}`).

**`lib/transcribe-meeting.ts`** (server-only) — separate from `lib/transcribe.ts` because the prompt is different. Takes audio URL, calls Lovable AI Gateway (`google/gemini-2.5-flash`), returns `{ transcript, summary, keyDecisions, actionItems, questions }`. Prompt is meeting-focused: "You are taking notes for an internal team after a client/prospect call. Be specific, name people when they say their name, use plain English…". Audio-only payload — much smaller than the video pipeline.

**`lib/mutations/meeting.ts`** — `createMeeting(input)` (gated `admin/lead/editor/engineer`), `analyzeMeetingInBackground(id, audioUrl)`, `regenerateMeetingAnalysis(id)`, `deleteMeeting(id)`. `createMeeting` writes the row with `Status=Processing`, fires `void analyzeMeetingInBackground(...)`, returns `{ id }`. Background job sets `Status=Ready` (or `Failed`) and `revalidateTag("meetings")` + tag-by-id. Cascades blob delete on `deleteMeeting`, mirroring how Loops handles it.

### 4. UI

**`app/(app)/meetings/page.tsx`** — list view. Reuses the `bg-surface border border-rule rounded-card` family. Columns: title, lead, owner, created, duration, status badge. Top-right **New recording** button → opens recorder popup with no lead pre-bind. Search box across title/transcript/summary/action items.

**`app/(app)/meetings/[id]/page.tsx`** — detail page. Header (title editable inline, lead/owner/duration/source meta). Below: AI cards (Summary, Key Decisions, Action Items, Follow-up Questions) using the same `AiSummaryPanel`-style component, but a new `MeetingNotesPanel.tsx` with the 4 sections meetings cares about. Collapsible full transcript. **Regenerate** + **Delete** buttons (gated). **Link to lead** picker if not yet linked.

**`components/meetings/MeetingNotesPanel.tsx`** — Summary / Key Decisions / Action Items / Follow-up Questions cards. Empty-state pulse while `Status=Processing`.

**`components/meetings/MeetingsBrowser.tsx`** — list/search/filter component for `/meetings`.

### 5. Wiring into existing surfaces

- **`lib/nav.ts`** — add `/meetings` (sidebar + optionally show on home).
- **Lead drawer** (`components/leads/LeadSheet.tsx`) — replace the "Join meeting" link with `<JoinAndRecordButton>`; add a **Meetings** tab listing meetings linked to that lead with deep-link to `/meetings/[id]`.
- **Upcoming meetings widget** (`components/leads/UpcomingMeetings.tsx`) — same swap on the per-row join link.

### 6. Permissions / browser support

- Recorder shows a clear "Use Chrome or Edge — Firefox/Safari can't capture tab audio" warning if `getDisplayMedia` is missing or the user picks a screen/window source (only *tab* sources expose audio). Detect via the chosen track's `getSettings().displaySurface === "browser"`.
- Mic permission is requested separately. If denied, we still record tab audio only and surface a banner.
- Roles: `admin / lead / editor / engineer` can record + view all meetings. Clients can't see `/meetings` at all (not in nav, server-gated).

```text
Lead drawer
   │
   ▼  click "Join meeting"
┌──────────────┐         ┌─────────────────────────────────┐
│ Meet tab     │         │ Recorder popup (420×560)        │
│ (Google)     │         │  ● 00:12  ▓▓▓▓▓░░░ level        │
└──────────────┘         │  [ Stop & save ]                │
                         └─────────────────────────────────┘
                                  │ Stop
                                  ▼
                         Blob upload  →  createMeeting()
                                  │
                                  ▼
                         analyzeMeetingInBackground()
                         (Gemini → transcript + 4 sections)
                                  │
                                  ▼
                         Airtable row Status=Ready
                         /meetings/[id] shows notes
```

## Out of scope

- Speaker diarization ("who said what") — Gemini can guess but we won't push for accuracy. If needed later, swap to ElevenLabs Scribe with `diarize: true`.
- Real-time live transcription during the call.
- Calendar auto-creation of recordings (no cron watching the calendar — recording only starts when a human clicks Join).
- Email-the-notes-to-client flow.
- Editing AI sections from the UI (edit in Airtable, regenerate from UI).
- Zoom / Teams deep integration. The recorder is provider-agnostic — it just captures the tab the user shares.
- Backfilling past calls.

## Verification

1. `npx tsc --noEmit` + `npm run build` clean.
2. Open a Lead with an upcoming meeting → click **Join meeting** → confirm Meet tab + recorder popup both open, popup is pre-bound to the lead.
3. In the popup, click Start → pick the Meet tab → confirm level meter moves when each side speaks.
4. Click Stop → row appears at `/meetings` with `Status=Processing`. Wait ~30–60s → status flips to `Ready`, all 4 sections + transcript populated.
5. From `/leads/[id]` Meetings tab → click through to the same meeting.
6. From `/meetings` click **New recording** (no lead) → record 30s → save → confirm row created with no lead, picker available on detail page.
7. Permission paths: deny mic → still records tab audio with a warning. Pick a window instead of a tab → recorder explains and asks to retry.
8. Delete a meeting → row gone from Airtable, blob URL returns 404.
9. Regenerate → cards refresh with a new run.
10. Sign in as client role → `/meetings` returns 403 / hidden from nav.

