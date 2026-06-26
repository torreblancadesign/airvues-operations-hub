
# Fix commissions + show margin across the Founder page

Two changes, applied to both the legacy projection model (`lib/founder-math.ts`) and the new simulator model (`lib/scaling-math.ts`):

1. **Fix commission stacking.** Today every role's commission is applied to *all* project revenue. In reality each billable hour is assigned to one engineer (salaried OR commission-only), so commissions don't double up across the engineer roster. Head of Client Solutions is the only role that applies on top of every new sale.
2. **Surface margin everywhere it matters** — hero, today's run-rate card, "at goal" card, scenario table, gap analysis, and (already there) the simulator readout.

---

## 1. Correct commission model

New rule (used by both files):

```
engineer mix  = % of project revenue delivered by salaried engineers (slider, 0–100%)
engineer rate = mix * salariedRate + (1 - mix) * commOnlyRate
                e.g. 60/40 mix → 0.6*15% + 0.4*30% = 21%
sales rate    = clientSolutionsRate (default 15%) applied to all project revenue
                (single role; headcount affects fixed salary, not commission pool)

project commission = projectRevenue * (engineerRate + salesRate)
retainer commission = retainerRevenue * (per-role retainer toggles, default off)
```

Headcount of engineers no longer multiplies the commission pool. It only drives **fixed salary cost** (for salaried) and **capacity** (informational). Worst case the user mentioned (15% + 30% = 45%) corresponds to mix = 0% on project work.

### `lib/scaling-math.ts`

- Replace `commissionBase * count * rate` per role with the mix-based pool above.
- Add `salariedEngineerMix: number` (0..1) and remove the implicit per-head stacking.
- `commissionOnlyEngineers` keeps `count` for documentation/capacity, but commission is `(1 - mix) * projectRev * commOnlyRate`.
- `clientSolutions` commission = `projectRev * rate` (still respects the "include retainers" toggle).
- `headroomRevenue` recomputed against the new marginal rate (`1 - engineerRate - salesRate`).
- Output adds `marginPct` (alias of existing `netMarginPct`, kept for clarity).

### `lib/founder-math.ts`

- Replace `engineerCommission` + `shaniaCommission` (which stack on all revenue) with:
  - `salariedEngineerRate` (default 0.15)
  - `commissionOnlyRate` (default 0.30)
  - `clientSolutionsRate` (default 0.15)
  - `salariedMixPct` (default 0.6 — tune later)
- `variableRate` becomes `mix*salariedRate + (1-mix)*commOnlyRate + clientSolutionsRate`.
- Add `marginPct = (revenue - variableCosts - fixedMonthly) / revenue` to `FounderProjection`.
- `requiredRevenueForNetAnnual` keeps working since it uses `variableRate` (now derived from the new inputs).
- Defaults: with mix=0.6 → engineer 21% + sales 15% = 36% variable, vs today's 32.5% — close, slightly more conservative, and now changes correctly when the user moves the mix slider.

## 2. Margin surfaced in the UI

`components/founder/FounderDashboard.tsx`:

- **Hero ("Path to Founder Replacement Income")**: add a 4th HeroStat (or a small inline chip under the progress bar) showing **Current margin** with tone (emerald ≥ target, amber within 5pp, red below). Target defaults to 40% and can be edited in Assumptions.
- **Today's run-rate card (`ProjectionCard` "current pace")**: add a `Row` for **Margin** between "Estimated monthly profit" and "Founder ownership". Same on the "at goal" card.
- **Gap analysis tiles**: add a 5th tile (or replace one) showing **Current margin vs target**.
- **Scenario table ("Revenue → founder earnings")**: add a **Margin** column between "Monthly Profit" and "Founder Monthly (gross)", color-coded by tone.
- **Assumptions panel**: replace the two old commission inputs with four fields — Salaried engineer % (mix), Salaried engineer rate, Commission-only rate, Client Solutions rate — plus the existing fixed/overhead/payroll tax. Add **Target margin %** (default 40%).

`components/founder/TeamScalingSimulator.tsx`:

- Replace stacked `RoleEditor` commission display with a single **Engineer mix** slider (0–100% salaried) plus per-rate inputs. `count` stays per role for fixed-salary math.
- Update the "Commission breakdown" footer to show the split as **engineer pool** (broken down by mix) and **sales pool**, not per-headcount totals.
- Readout already shows margin; keep as-is. Update headroom hint copy to match the new marginal rate.

## Files

**Modified**
- `lib/founder-math.ts` — replace assumptions shape, add margin to projection, keep `requiredRevenueForNetAnnual` working.
- `lib/scaling-math.ts` — mix-based commission pool, drop per-head stacking, keep `ScalingOutput` shape (add `marginPct` alias).
- `components/founder/FounderDashboard.tsx` — margin chip in hero, margin row in both projection cards, margin column in scenario table, margin tile in gap analysis, updated Assumptions inputs.
- `components/founder/TeamScalingSimulator.tsx` — engineer mix slider, updated `RoleEditor` to drop the per-role commission stacking UI for engineers, updated breakdown copy.

**Not changed**
- `app/(app)/founder/page.tsx`, `lib/founder.ts` — server data unchanged.

## Notes / out of scope

- No Airtable schema changes. Mix and target margin live in client state / Assumptions (already client-only).
- Retainer commissions remain opt-in per role via existing checkbox — default off.
- "Capacity-aware" mix (auto-derive mix from salaried headcount × capacity vs total demand) is deferred; manual slider is enough for now.
