## Goal

Two related UX fixes for collapsible content:

1. **Leads side panel** — the "Paste meeting transcript / notes" field can be enormous and pushes everything below it offscreen. Make it collapsible.
2. **Quote editor + everywhere else** — collapsible sections exist but the affordance is invisible (a tiny `▾` / `▸` on the far right). Make it obvious.

---

## 1. Leads side panel — collapse the transcript

File: `components/leads/LeadSheet.tsx`

The "More Context" section (line 612) contains the giant paste-target textarea. When content is present (line 142-155 — read-only view), wrap it in a collapsible shell:

- Default state: **collapsed** when the transcript is longer than ~400 chars; otherwise expanded.
- Header bar shows: `▸ Transcript / notes` + a small meta count like `2,431 chars` so the user knows there's something inside without expanding.
- Clicking the header toggles. Persist open/closed in `localStorage` per-lead (key: `lead:${id}:notes-open`).
- When empty, keep the existing "Paste the meeting transcript here…" CTA as-is (no collapse needed).
- When `editing` is true (textarea open), force expanded.

## 2. Make the collapsible affordance obvious

File: `components/pipeline/QuoteSheetEditor.tsx`, the `Section` component (lines 482–536).

Currently the only hint is a 12px `▾` / `▸` glyph on the far right of a 5-px-padded row — easy to miss. Upgrade the header for `collapsible` sections only (non-collapsible sections unchanged):

- **Left-side chevron** next to the title (lucide `ChevronDown` / `ChevronRight`, 14px, `text-ink-muted`) — eyes go there first, not the far right.
- **Stronger hover state**: `bg-bg-elevated` (not /40) + ring on the chevron.
- **"Click to expand / collapse" microcopy** in `text-[10px] text-ink-faint` on the right side when collapsible (replaces the lone glyph). Reads e.g. `Click to expand` / `Click to collapse`.
- **Subtle border-left accent** (`border-l-2 border-rule`) on the header when collapsible, removed from non-collapsible — makes the row read as interactive.
- Keep keyboard accessibility: button already, add `aria-expanded={open}`.

## 3. Apply the same Section pattern to the new Leads collapse

Reuse the visual language from step 2 for the Leads transcript collapse so the affordance reads identically across both pages (chevron-left + microcopy-right + hover). No need to extract a shared component yet — duplicate the small header markup inside `LeadSheet.tsx`. If a third surface needs it later, lift to `components/ui/CollapsibleSection.tsx`.

## Out of scope

- Auditing every other page for hidden collapsibles (only Quote + Leads were called out). I can do a sweep in a follow-up if you want.
- Changing which sections default open vs closed in the Quote editor — only the visual affordance changes.
