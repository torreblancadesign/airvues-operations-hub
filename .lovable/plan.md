## Add employer payroll tax to Founder Dashboard

Model the employer-side FICA (~7.65%) that Airvues owes on founder compensation, so the dashboard shows true take-home–equivalent earnings.

### Math change (`lib/founder-math.ts`)

Add `employerPayrollTaxRate` to `FounderAssumptions` (default `0.0765` = 6.2% SS + 1.45% Medicare).

New derivation inside `project()`:

```
// founderGross is what founderMonthly represents today
payrollTaxMonthly = founderGross * employerPayrollTaxRate
founderNetMonthly = founderGross - payrollTaxMonthly
founderNetAnnual  = founderNetMonthly * 12
```

Tax is computed on founder comp (not all revenue), matching the "employer-side only" model the user picked. Extend `FounderProjection` with `payrollTaxMonthly`, `payrollTaxAnnual`, `founderNetMonthly`, `founderNetAnnual`. Keep the existing gross fields so the gross→net story is visible.

### UI change (`components/founder/FounderDashboard.tsx`)

1. **ProjectionCard** — add two rows under the existing founder monthly/annual:
   - "Employer payroll tax (7.65%)" — shown as a negative
   - "Founder net monthly" / "Founder net annualized" — bold, accent on the goal card. Make the *net annualized* the headline number (replace the current gross-annual accent treatment).
2. **Hero progress** — keep progress vs revenue goal as-is (revenue goal is unchanged). No change.
3. **Gap analysis** — switch "Current annualized" and "Goal annualized" to **net** values. Recompute `gapAnnual` from net.
4. **Scenario table** — add a "Founder Net Annual" column after "Founder Annualized" (gross). Highlight stays on closest-to-current row.
5. **Assumptions panel** — add `NumInput` for "Employer payroll tax (%)" with step 0.05, default 7.65.
6. **Footnotes** — update the goal card footnote to: "Net of employer payroll tax (Social Security 6.2% + Medicare 1.45%). Still before personal income taxes and assumes the comp structure is unchanged."

### Out of scope

- Social Security wage-base cap ($168,600). At founder annualized > ~$280K the 6.2% portion would taper; we treat the rate as flat for v1 since the user picked a flat editable %.
- Personal income tax modeling (already called out).
- Persistence of the new assumption.

### Files touched

- `lib/founder-math.ts` — extend type, defaults, `project()` output
- `components/founder/FounderDashboard.tsx` — projection cards, gap, scenario table, assumptions input
