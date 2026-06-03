## Goal

In the TopBar Calendar dropdown (shown in the screenshot), the "Join ↗" link on each event currently just opens the conference URL in a new tab. Make it behave like the Leads page "Join + record" button: open the meeting AND launch the recorder popup pre-bound to source (meet/zoom).

## Changes

**`components/header/CalendarWidget.tsx`**
- Replace the per-event `<a href={ev.conferenceLink ?? ev.link}>` wrapper with a structure that keeps the event row as a click target for the conference URL, but adds a dedicated `<JoinAndRecordButton>` (existing component at `components/meetings/JoinAndRecordButton.tsx`) where the current "Join ↗" mini-label sits — only when `ev.conferenceLink` is present.
- Pass `meetingUrl={ev.conferenceLink}`, no `leadId` (calendar events aren't tied to a Lead), and a compact `label="Join ↗"` plus a small `className` matching the existing emerald 10px mono style.
- Keep "Open Calendar ↗" and the rest of the dropdown unchanged.
- To avoid nested `<a>` issues, change the outer `<a>` to a `<div>` (or wrap the title/meta in a separate anchor) so the embedded button isn't nested in an anchor.

## Notes

- No backend, no Airtable, no schema changes.
- `JoinAndRecordButton` already handles popup-blocked fallback and source inference from URL host.
- No change to `/meetings` page or recorder route.

## Out of scope

- Linking a recording back to a calendar event (no Lead/event association on the Meeting record). The recorder will save as an un-linked meeting, same as the existing top-right "New recording" button flow.
