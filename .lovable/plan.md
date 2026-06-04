## Goal

Make meeting transcripts label who's speaking — your voice (mic) as you, and the meeting tab audio as the client/other person.

## Why the current setup can't do this

`MeetingRecorder.tsx` mixes mic + tab audio into a single mono stream before encoding. Once mixed, no AI can reliably tell the two sources apart. We need to keep them separate inside the file.

## Approach: stereo-split capture

Instead of true diarization (which is unreliable on mixed audio), we use a deterministic trick:

- **Left channel** = your mic
- **Right channel** = the meeting tab audio
- Tell the AI which channel is which → it labels every line correctly, every time.

This works even when both people talk at the same time, costs nothing extra, and doesn't change file size meaningfully.

## Changes

### 1. `components/meetings/MeetingRecorder.tsx` — record stereo

- Replace the single `MediaStreamDestination` with a stereo graph:
  - Create a `ChannelMergerNode` with 2 inputs.
  - Route mic source → merger input 0 (left).
  - Route tab audio source → merger input 1 (right).
  - Merger → `MediaStreamDestination` → `MediaRecorder`.
- Force the destination to 2 channels (`createMediaStreamDestination` then set `channelCount = 2`, `channelCountMode = "explicit"`).
- If mic was denied, fall back to mono tab-only (current behavior) and skip the speaker-labeling prompt addition.
- Pass a new flag to the upload/create call (e.g. `channelLayout: "mic-left/tab-right" | "mono"`) so the server knows whether to use the speaker-aware prompt.

### 2. Persist the channel layout on the Meeting record

- Add a `Channel Layout` field on the Meetings Airtable table (single-select: `mic-left/tab-right`, `mono`). Or store as plain text — whichever matches existing schema conventions.
- Extend `MeetingCreateInput` in `lib/meetings-types.ts` with `channelLayout`.
- `lib/mutations/meeting.ts` `createMeeting` writes it; passes it into `analyzeMeetingInBackground`.

### 3. Resolve the recorder's name

- In `app/recorder/page.tsx` (server component), resolve the signed-in user via `getAppSession()` + `resolvePersonByEmail()` and pass `recorderName` to `<MeetingRecorder />`.
- Forward `recorderName` through `createMeeting` → store on the Meeting record (new `Recorder Name` field, or reuse Owner's name at analyze time by reading the linked Owner record).
- Lead name (already available) is used as the "other speaker" label fallback.

### 4. `lib/transcribe-meeting.ts` — speaker-aware prompt

- New `analyzeMeeting(audioUrl, opts)` signature: `opts = { channelLayout, recorderName, otherName }`.
- When `channelLayout === "mic-left/tab-right"`, the prompt tells Gemini explicitly:
  > "The audio is stereo. The LEFT channel is `{recorderName}` (Airvues team). The RIGHT channel is `{otherName ?? "Client"}` (the other party on the call). Label every transcript line with the correct speaker based on which channel the voice is on. Format each line as `Speaker name: text`."
- When `channelLayout === "mono"`, keep today's fallback (label as "Team" / "Client" heuristically).
- Update `MeetingAnalysis.transcript` rendering — already free-form text, no UI change needed.

### 5. `lib/mutations/meeting.ts` `regenerateMeetingAnalysis`

- Read back `Channel Layout`, `Recorder Name`, linked Lead name, and pass them into `analyzeMeeting()` so re-runs stay speaker-labeled.

## Out of scope

- True acoustic diarization (treating a mono recording and inferring speakers) — explicitly not doing this; not reliable enough.
- UI redesign of the transcript panel. The existing transcript view will just start showing `Jose: …` / `Acme Corp: …` lines.
- Multi-participant calls with 3+ people — both remote participants will share the right channel and be labeled as one speaker. Could be improved later via Gemini's voice-difference detection within the right channel.

## Technical notes

- Browser support: `ChannelMergerNode` + stereo `MediaRecorder` works in Chrome/Edge today (already the only supported browsers per the existing `supported` check).
- File size: stereo opus at 64 kbps is the same bitrate; Opus handles stereo without doubling size.
- Audio gateway upload size cap (20 MB) is unchanged; stereo encoding doesn't push past it.
- Echo cancellation on the mic might suppress some of "your" voice when it bleeds in from the tab — already enabled; leaving as-is.
