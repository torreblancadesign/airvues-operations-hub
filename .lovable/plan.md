## Plan

Update the mobile calendar dropdown so it is anchored to the viewport instead of the small calendar button container.

### What will change
- In `components/header/CalendarWidget.tsx`, detect compact/mobile usage and render the open calendar panel as a fixed-position viewport overlay.
- On mobile, place it below the sticky header with safe left/right margins and a viewport-based max height so it cannot extend off-screen.
- Keep the desktop behavior as a normal dropdown beside the TopBar button.
- Make the event list scroll inside the panel when there are too many events, rather than letting the whole panel get cut off.

### Technical details
- Replace the shared `absolute right-0` panel positioning with responsive classes:
  - mobile/compact: `fixed left-2 right-2 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)]`
  - desktop: existing `md:absolute md:right-0 md:top-auto md:left-auto`
- Use `max-h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))]` and `overflow-hidden flex flex-col` so the header stays visible and the event list scrolls.
- Adjust outside-click handling only if needed so tapping outside still closes the panel.