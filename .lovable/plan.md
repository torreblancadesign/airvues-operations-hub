## Changes

### 1. 12-hour AM/PM time (`components/header/TimeWeatherWidget.tsx`)
- Flip `formatTimeHM` and the large local-time formatter to `hour12: true` (drops `hour: "2-digit"` leading zero so it reads `9:04 PM` not `09:04 PM`).
- Keep `tabnum` styling; widen the trigger button slightly so the " AM"/" PM" suffix fits without wrapping.
- `LiveClock` on the login page stays UTC 24h (unrelated to navbar).

### 2. Show the user's city next to the weather chip
- The panel already shows city under "Weather". Also surface it on the **collapsed trigger button** so it's visible without opening: `{city} · 72°` (falls back to just temp if city is null).
- In the expanded header, add a small "{city}, {region}" line under "Your local time" so the user sees where the local zone is anchored.

### 3. Mobile support
Currently `TopBar` is `hidden md:flex`, so the widget is desktop-only. Two parts:

- **`components/header/TopBar.tsx`**: remove `hidden md:flex`, make it `flex` at all sizes. Tighten padding on mobile (`px-3`), keep gap small. The three widgets (Gmail, Calendar, TimeWeather) are already compact icon-style triggers and fit.
- **`app/(app)/layout.tsx`**: no structural change — TopBar already renders above `{children}`, so it will appear above the mobile content. The mobile hamburger (`MobileNav`) is a separate fixed element and won't conflict.
- Verify the dropdown panel (`w-[300px]`, `right-0`) doesn't overflow a 360px viewport — it has 16px of safe space; if needed, cap at `w-[calc(100vw-1rem)]` with `max-w-[300px]`.

## Out of scope
- No changes to `LiveClock` (login page), `CalendarWidget`, or `GmailWidget`.
- No changes to weather data source — city already comes from Vercel edge geo headers via `lib/weather.ts`.
