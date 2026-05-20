## Goal
Refocus `/engineering` away from $-commission gamification toward **capacity planning**: hours, scope, and what project each story belongs to. Engineers may have different commission rates, so no flat % anywhere on this page.

## Changes

### 1. Remove all commission UI + the flat 15% constant from this page
- `components/engineering/StoryCard.tsx` — drop the "15% commission · $X" footer row.
- `components/engineering/EngineeringBoard.tsx`:
  - Replace "Open commission pool" KPI with **"Open hours"** (sum of `hours` across active stories, with a sub like `X% scoped` if useful).
  - In each engineer section header, replace `Open $` / `Open commission` columns with **`Active hrs`** (sum of `hours` on non-complete stories) and **`Worked hrs`** (sum of `hoursWorked`). Keep `Active` story count.
  - Drop the "earned commission" mention in the per-engineer status mini-strip; keep status counts only.
- `components/engineering/StorySheet.tsx` — remove the commission row from the drawer (keep Invoice/Cost visible to admins per existing visibility, but no "× 15%").
- `lib/engineering.ts` / `lib/engineering-types.ts` — leave `commission` field for now (consumed elsewhere like `/me`, `/money`); just stop displaying it on `/engineering`. No type churn.

### 2. Surface quote + description on each StoryCard
Stories already carry `quoteIds` but not the quote label. Add a lightweight quote lookup so each card can show **"Quote: {label}"**.

- `lib/engineering.ts`:
  - Fetch Quotes alongside Stories + People (parallel `Promise.all`). Pull `Quote ID`, `Project Name`, `Company Name` (lookup) from `Tables.Quotes`. Cache-tag `engineering:quotes`.
  - Build `quoteMap: Map<recId, { label, projectName, company }>`.
  - Add `quoteLabels: string[]` to each `Story` (mirrors `quoteIds`, falls back to `"(no quote)"`).
- `lib/engineering-types.ts` — add `quoteLabels: string[]` to `Story`.
- `components/engineering/StoryCard.tsx`:
  - Add a row under the title showing `📄 {quoteLabels[0]}` (truncate, max 1).
  - Add a 2-line clamped `description` preview below the meta row when `story.description` is non-empty.
  - Tighten/restructure so the card stays compact: title → quote → client · sprint → description (2-line clamp) → hours progress.

### 3. Replace Leaderboard with a Capacity panel
New component `components/engineering/CapacityPanel.tsx`. Replaces the `<Leaderboard />` mount in `EngineeringBoard.tsx`.

Per non-orphan engineer, show one row sorted by **active hours desc**:
- Name + role
- **Active stories** count (stories where status ≠ Completed)
- **Total assigned hours** (sum of `hours` on active stories)
- **Hours worked so far** (sum of `hoursWorked` on active stories)
- A horizontal bar = `workedHrs / assignedHrs` with over-budget tint when > 100%
- Optional: tiny status breakdown chips (todo / in-progress / QA)

No commission. No medals. No `$`.

Computation lives in `lib/engineering.ts` — extend `EngineerGroup.totals` with:
- `activeHoursAssigned: number` (sum `hours` on non-complete)
- `activeHoursWorked: number` (sum `hoursWorked` on non-complete)

`tallyGroup` populates these. Existing `openInvoice` / `openCommission` / `earnedCommission` stay (other surfaces still read them) but are unused on this page.

### 4. Filter bar
No structural change. The `Open commission pool` KPI tile becomes `Open hours`; everything else (search, status, engineer, client, sprint, orphan toggle) is unchanged.

## Files touched
- `lib/engineering.ts` — add Quotes fetch + quote map + capacity totals
- `lib/engineering-types.ts` — `Story.quoteLabels`, two new fields on `EngineerGroup.totals`
- `components/engineering/StoryCard.tsx` — strip commission, add quote + description
- `components/engineering/EngineeringBoard.tsx` — swap KPI, swap header columns, mount CapacityPanel instead of Leaderboard
- `components/engineering/CapacityPanel.tsx` — new
- `components/engineering/StorySheet.tsx` — remove commission row
- `components/engineering/Leaderboard.tsx` — leave file in place (unimported) or delete; suggest delete

## Out of scope
- Per-engineer commission rates on the `People` table (separate effort once schema lands).
- Capacity targets per engineer (would need `People.Weekly Capacity Hours` — same future work as Phase D.5 in `sprint-plan-types.ts`).
- Removing commission everywhere in the app (`/me`, `/money` still display it intentionally).

## Verify
- `/engineering` shows zero `%` or `$ commission` text anywhere.
- Each StoryCard shows quote name + description preview when present.
- Capacity panel ranks engineers by active assigned hours.
- `npx tsc --noEmit` clean; `npm run build` clean.
