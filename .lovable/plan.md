## Goal

Make the public recording page (`/r/[token]`) feel like a real Airvues surface — same brand language as the login page — instead of the current bare black layout.

## What changes

**File: `app/r/[token]/page.tsx`** (only file touched)

1. **Branded header**
   - Replace the plain "Airvues" text with the real logo (`/public/airvues-mark.png`, same asset used on login) + wordmark lockup.
   - Right side: small mono eyebrow "Shared Recording" with a thin emerald hairline divider underneath the header (matches `PageHeader` accent).

2. **Aurora background**
   - Reuse `<AuroraBackdrop />` from `components/login/AuroraBackdrop.tsx` behind the whole page, swapped to lower intensity so it doesn't fight the video. (Either pass a prop to dim it, or wrap in a container with reduced opacity — leaning toward a simple wrapper with `opacity-60` and `pointer-events-none` so we don't touch the login component.)
   - Page background switches from pure `bg-black` to `bg-bg` (the app's near-black `#0B0F17`) so the aurora reads properly.

3. **Video card treatment**
   - Wrap the `<video>` in a `bg-surface/85 backdrop-blur-xl border border-rule rounded-card` card with a soft shadow — same glass treatment as the login sign-in card.
   - Add the same top emerald hairline accent the login card uses.
   - Keep the 16:9 aspect, autoplay, controls.

4. **Metadata block**
   - Title in `font-display` / larger, tracked tight.
   - "Recorded by {owner} · {relative date}" in mono uppercase eyebrow style.
   - Add a subtle "Powered by Airvues Loops" footer line.

5. **Footer**
   - Replace `airvues.com` plain text with the same footer pattern as login: left side small mono "Airvues LLC · © {year}", right side a `<LiveClock />` (reused from `components/login/LiveClock.tsx`).

6. **Responsive**
   - Header padding tightens on mobile, video card stays full-width with `max-w-5xl` on desktop.
   - Aurora blobs already animate nicely at all sizes — no extra work.

## What does NOT change

- No changes to recording, upload, data layer, share-token logic, view counting, or middleware.
- No new dependencies.
- Login page is untouched; we just reuse its components.

## Verification

- Visit `/r/{token}` for an existing loop in preview → confirm logo renders, aurora visible behind glass card, video plays, clock ticks in footer.
- Check mobile viewport (390px) → header + video card don't overflow.
- `npx tsc --noEmit` + `npm run build` clean.
