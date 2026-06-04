# Show linked meetings on the Lead drawer

When a meeting is linked to a lead, surface its AI notes + transcript inside the `LeadSheet` drawer. Default to collapsed cards so the section stays compact; the user expands what they want to read.

## UX

New section in `LeadSheet` titled **"Recorded meetings"**, placed just below the existing "Meeting Date / Link" details block.

- Header: `Recorded meetings · N` with an eyebrow style matching the rest of the drawer.
- Empty state (no linked meetings): hidden entirely — no section, no real-estate cost.
- For each linked meeting, render one collapsed row:
  - One-line summary: meeting title · date · duration · status pill (Processing / Ready / Failed) · link `Open ↗` to `/meetings/[id]`.
  - Click the row to expand. Expanded content:
    - `MeetingNotesPanel` (Summary / Key Decisions / Action Items / Follow-up Questions) — reuses the existing component.
    - A second nested `<details>` for the raw transcript (kept collapsed even when the notes panel is expanded, since transcripts are long).
- All rows start collapsed. Use native `<details>/<summary>` for zero-JS state + a11y, styled to match the drawer.

## Data flow

`LeadSheet` is a client component, so meetings must be passed in as props from the server.

1. `app/(app)/leads/page.tsx` — fetch meetings once and group:
   - `const meetings = await listAllMeetings()` (new thin wrapper, mirrors `listMeetingsForLead` but for the whole table, cached under tags `["meetings", "airtable"]`).
   - Build `meetingsByLead: Record<string, Meeting[]>` keyed by `linkedLeadId`, sorted newest first.
   - Pass to `<LeadsDashboard meetingsByLead={...} />`.
2. `components/leads/LeadsDashboard.tsx` — accept the new prop and forward it to `LeadSheet` (look up by selected lead id).
3. `components/leads/LeadSheet.tsx` — accept `meetings: Meeting[]` (default `[]`), render the new section.

If `listAllMeetings` doesn't exist yet, add it to `lib/meetings.ts` next to `listMeetingsForLead` using the same `listRecordsCached` shape filtered to non-deleted rows.

## Files touched

- `lib/meetings.ts` — add `listAllMeetings()` (cached read).
- `app/(app)/leads/page.tsx` — fetch + group + pass `meetingsByLead`.
- `components/leads/LeadsDashboard.tsx` — accept + forward prop to the selected `LeadSheet`.
- `components/leads/LeadSheet.tsx` — new "Recorded meetings" collapsible section using `MeetingNotesPanel`.

## Out of scope

- No edits to the meetings table or recorder.
- No re-record / re-link UI inside the drawer (that already lives on `/meetings/[id]`).
- No transcript search or copy buttons beyond what already exists.
