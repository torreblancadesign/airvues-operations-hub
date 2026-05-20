## Plan

Fix the calendar showing event times in the server's timezone (UTC on Vercel) instead of the viewer's local timezone.

### What will change
- Stop formatting the event start label on the server in `lib/calendar.ts`. The server returns the raw ISO `start` string already; the client will format it using the browser's local timezone.
- In `components/header/CalendarWidget.tsx`, format `ev.start` with `Intl.DateTimeFormat` inside a small client helper that runs in the user's browser, so a 9am PST meeting renders as "Wed, 9:00 AM" for a PST user.
- Handle all-day events with a date-only format (no time, no TZ shift).

### Technical details
- `lib/calendar.ts`: keep `startLabel` field for backward compat but compute it the same way it is computed today; the client will override it. Cleaner: drop the `startLabel` usage on the client and call a local `formatStart(start, allDay)` helper in `CalendarWidget` that uses `Intl.DateTimeFormat(undefined, {...})` (undefined locale + no explicit timeZone = use the browser's locale and tz).
- For all-day events, parse `YYYY-MM-DD` manually (avoid `new Date("2026-05-20")` UTC-midnight bug) and format with weekday/month/day in local time.