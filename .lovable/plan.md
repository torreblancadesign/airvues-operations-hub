## Goal

Make the Scaling Outlook **roster-first** so you can see, at any revenue point on the slider: who is on the team, what they're being paid (salary + commission $), why we're proposing each new hire, and how that changes margin and your take-home. Today the section only shows aggregate counts like "+1S +2C" with no salary, no tier, no per-person earnings — so it's impossible to judge affordability or use it in a negotiation.

## What changes (UI only — math reuses what's already there)

### 1. New "Roster at this revenue" panel (replaces the small Readout grid)

Driven by the hover point (or a dedicated revenue slider underneath the charts so it works on touch too). One row per tier, current roster + proposed hires merged:

```text
Tier                Heads  Salary/mo  Commission rate  Hours used / cap  Earned/mo (each)  Tier cost/mo
Senior salaried     2 (+1) $8,000     15% proj / 0%    320 / 480          $8,000 + $1,200   $27,600
                                       ret              (67%)              = $9,200 each
Contractor pool     2      $0         30% proj          320 / 320          $0 + $2,400      $4,800
                                                        (100%)             = $2,400 each
Head of Client Sol  1      $6,000     15% proj / 5%     —                  $6,000 + $4,500   $10,500
                                       ret                                  = $10,500
─────────────────────────────────────────────────────────────────────────────────────────────
Totals              5 (+1) salaries: $22,000   commissions: $8,100   team cost: $30,100
```

Hires proposed by auto-hire are shown inline as `2 (+1)` with an amber chip — not as an opaque "+1S". Each added head shows the **same salary/commission as the tier they join**, so the math is self-explanatory.

### 2. "Why this hire?" line under the roster

For each hire the auto-proposal added at this revenue point, one sentence:

- "+1 Senior salaried at $8,000/mo + 15% — covers ~160 unmet project hrs/mo, keeps margin ≥ 40%."
- "+1 Contractor at 30% commission — salaried option would drop margin to 36%."
- "Convert 1 Contractor → Senior salaried — margin is 12% above target, locks in capacity at lower marginal cost."

Pulled from `HireProposal.detail` (already exists) but enriched with the actual tier salary/rate and the margin reason.

### 3. "Affordability check" sub-panel

Three quick what-ifs computed on the fly from the current revenue point's `proposeRoster` output, answering exactly "can I afford X right now?":

- **Add a fully-salaried engineer (no commission)** at $X/mo → new margin Y% (✓/✗ vs target), founder net delta −$Z/mo.
- **Add a salaried engineer with 15% commission** at $X/mo → new margin Y%, delta −$Z/mo.
- **Add a commission-only contractor (30%)** → new margin Y%, delta −$Z/mo.

`$X` is editable inline (default = first salaried tier's salary). This is the negotiation tool — change the salary, see immediately what margin you'd be at.

### 4. Charts: keep, but shrink and re-label

The five existing charts stay (Margin %, Demand vs capacity, Retainer vs project hrs, Team size FTEs, Founder net) but:

- Collapse into a single 2-column compact grid (chart height 100px instead of 140px) so the new Roster panel is the primary content above the fold.
- Add a small "Roster at $Xk/mo" label above the panel that updates with hover/slider.
- Add a thin slider under the charts (bound to the same hover index) so you can drag through revenue points without needing to hover a chart.

### 5. Hiring roadmap: enrich with $ and tier

Current roadmap shows `$45k/mo → +1 salaried`. Change each row to:

```text
$45k/mo  →  +1 Senior salaried ($8,000/mo + 15%)  ·  Team: 5 → 6  ·  Margin: 42% → 40%  ·  Your net: $14.2k → $13.8k
```

Same data, but you can see the actual cost of each proposed hire and what it does to margin and your take-home.

## Technical notes

- **No math changes** in `lib/scaling-math.ts`. The proposal already picks a real tier (first eligible salaried, then first commission); we just need to surface which tier and apply its salary/rate in the UI.
- One small addition to `HireProposal`: include the tier id(s) hired into, so the UI can look up label/salary/rate without re-deriving. Specifically extend `proposeRoster` to record `tierHires: { tierId, kind, delta }[]` alongside the existing aggregate counters.
- Affordability check calls `computeScenario` with a synthetic tier added — pure function, cheap, no new API surface.
- All changes confined to `components/founder/ScalingCurves.tsx` and a minor field addition in `lib/scaling-math.ts` (`tierHires` on `HireProposal`). Type-safe via existing `EngineerTier` shape.

## Files touched

- `lib/scaling-math.ts` — add `tierHires` to `HireProposal`, populate it in `proposeRoster`.
- `components/founder/ScalingCurves.tsx` — rebuild the readout area into Roster panel + Why-this-hire + Affordability check; shrink charts to a compact grid; add bound slider; enrich hiring roadmap rows.

No changes to `TeamScalingSimulator.tsx`, dashboard, or persistence.
