## Goal

Add a playback speed selector to Loop videos so viewers can slow down (or speed up) recordings — useful for reviewing detailed walkthroughs.

## Where it appears

Two surfaces render the loop `<video>`:

1. **Internal detail page** — `app/(app)/loops/[id]/page.tsx`
2. **Public share page** — `app/r/[token]/page.tsx`

Both currently use a plain `<video controls>`. Native browser controls do include a speed menu on Chrome/Edge/Firefox desktop, but it's hidden behind a right-click / kebab menu and is missing entirely on Safari's default controls and on most mobile browsers. So we add an explicit, always-visible control.

## Design

New small client component `components/loops/LoopPlayer.tsx` that wraps the existing `<video>` and adds a speed pill above the top-right corner (or bottom-right, floating over the video). Keeps current styling — same `aspect-video`, `bg-black`, poster, `controls`, autoplay flag as a prop.

Speed options: `0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×`. Default `1×`. Persist last choice per surface in `localStorage` via existing `useLocalStorageJSON` from `lib/use-local-storage.ts` (keys: `loops:playbackRate:internal` and `loops:playbackRate:public`), so a user who slows things down stays slowed down across loops.

Interaction: click the pill → dropdown of options → sets `videoRef.current.playbackRate` and updates state. Also reapply on `loadedmetadata` (browsers reset rate when the source loads).

Styling matches existing Airvues chips (font-mono, uppercase micro-label, `bg-surface/85 border border-rule rounded`, emerald hover), consistent with the surrounding aesthetic on both pages.

## Files

- **New:** `components/loops/LoopPlayer.tsx` — `"use client"`, props `{ src, poster, autoPlay?, className?, storageKey }`. Renders `<video ref controls>` plus the speed selector overlay.
- **Edit:** `app/(app)/loops/[id]/page.tsx` — replace the raw `<video>` (lines around the current player) with `<LoopPlayer src={loop.videoUrl} poster={loop.posterUrl ?? undefined} storageKey="loops:playbackRate:internal" />`.
- **Edit:** `app/r/[token]/page.tsx` — replace the raw `<video autoPlay>` with `<LoopPlayer ... autoPlay storageKey="loops:playbackRate:public" />`. Keep the surrounding branded frame (aurora border, aspect-video wrapper) untouched.

No changes to data layer, mutations, or types.

## Out of scope

- Keyboard shortcuts (`<` / `>`) — can follow later if useful.
- Applying the same control to Meetings recordings — separate feature; ask first if desired.
