## Problem

The Story drawer uses `position: fixed`, which *should* anchor it to the viewport. But the `(app)` layout wraps page content in a `.page-enter` div, and that class animates `transform: translateY(...)` and lands at `transform: translateY(0)` via `both` fill mode. Any non-`none` `transform` on an ancestor turns it into the containing block for `position: fixed` descendants — so the drawer is positioned relative to that wrapper instead of the viewport. When you scroll the page and then open a story, the drawer renders at the top of the wrapper (now scrolled off-screen) instead of pinned to the visible viewport.

## Fix

Portal the drawer (overlay + `<aside>`) to `document.body` so it escapes the transformed ancestor entirely. Body is not animated, so `fixed` resolves against the viewport as intended.

### Changes

- **`components/engineering/StorySheet.tsx`** — wrap the existing returned JSX (overlay div + aside) in `createPortal(..., document.body)`. Guard with a `mounted` flag (`useEffect` setting `true`) so SSR doesn't try to read `document`. No styling, props, or behavior changes — just the render target. While the drawer is open, also set `document.body.style.overflow = "hidden"` and restore on close/unmount so the page behind doesn't scroll when the user wheels over the drawer.

That's it — one file, ~10 lines of wrapper code. The `.page-enter` animation stays as-is (it's intentional for page transitions), and every other consumer of StorySheet automatically benefits.

## Out of scope

- Touching `.page-enter` itself or any other page's layout
- Replacing the drawer with a different component
- Other drawers (`InvoiceSheet`, `QuoteSheet`, `ClientSheet`) — none were reported broken, and they may or may not have the same issue depending on their mount point. Happy to apply the same portal fix to them in a follow-up if you want.