## Goal

Make the **firm snapshot the hero of the home page** — move it to the top, blend the most important numbers from Earnings + Pipeline into one editorial bento that the team will actually want to check daily.

## New section position

Reorder `app/(app)/page.tsx`:

```
1. Greeting (unchanged)
2. ▶ Firm pulse        ← NEW, hero spot
3. Your day
4. The board
5. The stack
6. (old bottom snapshot strip — DELETED)
```

## What it shows

One **hero tile** + five **satellite tiles**, all on real data.

```
┌────────────────────────────────────────────────────┬──────────────────────┐
│  YTD REVENUE                                       │  BOOKED YTD          │
│  $284,300                          ◐ 56% of $500k  │  $312,400  ↑18 deals │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  pace ────────────│    │  ───────────────────┤
│  ✓ Ahead of pace by $12k                           │  OPEN PIPELINE       │
│                                                    │  $94,200 · 7 quotes  │
│                                                    │  ⚠ $38k stalled >14d │
│                                                    ├──────────────────────┤
│                                                    │  MRR                 │
│                                                    │  $28,400  ◐ 68%      │
│                                                    │  6 active subs       │
├────────────────────────────────────────────────────┼──────────────────────┤
│  ACTIVE WORK         │  OPEN AR        │  QUOTE → PAID                    │
│  $122k · 9 projects  │  $41k · 12 inv  │  64% · 18 paid / 28 sent         │
│  $18k unpaid         │  3 overdue      │                                  │
└──────────────────────┴─────────────────┴──────────────────────────────────┘
```

Six metrics, no fluff:

| Tile | Primary | Secondary | Source |
|---|---|---|---|
| **YTD Revenue** (hero) | `$284,300` | progress bar + pace verdict (Ahead/Behind $X · need $Y/mo) | `revenueYtd()` |
| Booked YTD | `$312,400` | `N quotes signed` | derived from `listAllQuotes()` |
| Open Pipeline | `$94,200` | `N quotes · $X stalled >14d` | `listAllQuotes()` |
| MRR | `$28,400` | `N active subs · 68% of target` | `mrr()` |
| Active Work | `$122k` | `N projects · $X unpaid` | `listAllQuotes()` |
| Open AR | `$41k` | `N invoices · N overdue` | `openReceivables()` |
| Quote → Paid | `64%` | `18 paid / 28 sent` | `listAllQuotes()` |

(That's 7 — the layout uses hero + 6 satellites in a 12-col bento; final count locked at 7.)

Each tile is a `<Link>` to its deep route (`/money`, `/pipeline?stalledOnly=1`, etc.) so it doubles as a jump-off.

## Visual direction — "Bloomberg terminal meets Linear"

- **Hero tile (col-span-7)**: oversized 48px tabular-nums number, eyebrow label in mono uppercase, full-width progress track using emerald → emerald-glow gradient, pace verdict line with ✓/⚠/✗ glyph (emerald/amber/red).
- **Satellites (col-span-5, stacked 2-up)**: 28px numbers, single secondary line, tiny inline status dot when relevant.
- **Bottom row (3 equal tiles)**: 22px numbers, compact.
- **Surface**: `bg-surface` cards, `rounded-card`, `border-rule`. Hover: `border-emerald/40`, `-translate-y-px`, soft emerald glow shadow (existing pattern from `HomeKpiCard`).
- **Hairline accent** under the section header — same emerald gradient sliver already used on `PageHeader`.
- **NumberTicker** count-up on mount (already in `components/ui/NumberTicker.tsx`) for the hero + the three currency satellites. Respects reduced-motion.
- **Tone semantics**: pace ≥ 100% emerald, 80–99% amber, <80% red. Stalled $ in amber. Overdue count in red.

## Files to add / change

**New** `lib/firm-pulse.ts` — single server function `getFirmPulse()` that returns the 7-tile payload:
- calls `revenueYtd()`, `mrr()`, `openReceivables()`, `listAllQuotes()` in parallel
- derives bookedYtd, openPipeline (+ stalled), activeWork (+ unpaid), conversion from the quotes array (same math already in `PipelineDashboard` lines 114–183 — extracted server-side, no duplication on the home page).

**New** `components/home/FirmPulse.tsx` — client component that renders the bento. Accepts the `FirmPulse` payload + a deep-link map.

**Edit** `app/(app)/page.tsx`:
- Drop `revenueYtd / mrr / openReceivables` direct calls + `SnapshotItem` helper + bottom strip.
- Add `getFirmPulse()` call, render `<FirmPulse … />` as the first section right after the greeting.
- Keep "Open Earnings →" CTA inside the new section (right-aligned in the section header aside).

**No changes** to: pipeline page, money page, KPI lib internals, schema, mutations.

## Out of scope

- Sparklines / historical trend lines (would need a new time-series read).
- MoM deltas (we don't snapshot prior month values yet).
- Reordering The Board / The Stack / Your Day.
- Any write paths.

## Acceptance

- Firm pulse is the first thing under the greeting on `/` (desktop + mobile).
- 7 tiles render with live data; each links to the right deep view.
- Old bottom 3-item strip is gone.
- `npx tsc --noEmit` + `npm run build` clean.
