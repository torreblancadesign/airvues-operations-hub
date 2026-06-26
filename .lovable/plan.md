## Goal

Upgrade the Team Scaling Simulator so the user can model a heterogeneous engineering roster (multiple commission tiers), drive the "engineer mix" from real capacity, and get a clear "you need to hire" signal based on projected revenue.

All changes are scoped to the Founder simulator UI and its pure math module. No Airtable schema changes, no other pages touched.

---

## 1. Roster: multiple commission-only tiers

Today `commissionOnlyEngineers` is a single `{count, rate}` row. Replace with a list so the user can stack tiers (e.g. 2 @ 30%, 1 @ 20%, 2 @ 35%).

**Data shape (`lib/scaling-math.ts`):**

```
type EngineerTier = {
  id: string;            // local uuid for React keys
  label: string;         // "Senior", "Junior", "Contractor A" — free text
  count: number;
  monthlySalary: number; // 0 for commission-only
  commissionRate: number;// 0..1
  hoursPerMonth: number; // capacity per head, default 160
};

ScalingInputs {
  salariedEngineers: EngineerTier[];        // was single role
  commissionOnlyEngineers: EngineerTier[];  // was single role
  // salariedEngineerMix REMOVED — derived from capacity now
  ...
}
```

Migration: keep `defaultInputs()` seeding 1 salaried tier + 1 commission tier so existing scenarios still make sense. Old saved scenarios in localStorage are versioned with a `v` field; on read, if `v` is missing, map the old single roles into one-element arrays.

**UI (`TeamScalingSimulator.tsx`):**

- Two stacked sections: "Salaried engineers" and "Commission-only engineers".
- Each row: label, count, salary (salaried only), commission %, hrs/month, capacity readout (`count × hours`), remove button.
- "+ Add tier" button under each section.

---

## 2. Capacity-driven engineer mix (replaces the slider)

Drop the manual mix slider. Compute it from the roster and a single new input:

```
revenueHourlyRate  (default: pull from a sensible blended rate, e.g.
                    monthlyProjectRevenue / totalSalariedCapacityHours
                    on first render; user can override)
```

Then per scenario:

```
projectHoursNeeded   = monthlyProjectRevenue / revenueHourlyRate
salariedCapacity     = sum(salaried tiers: count × hoursPerMonth)
commissionCapacity   = sum(commission tiers: count × hoursPerMonth)
salariedHoursUsed    = min(projectHoursNeeded, salariedCapacity)  // priority fill
commissionHoursUsed  = min(projectHoursNeeded - salariedHoursUsed, commissionCapacity)
unmetHours           = max(0, projectHoursNeeded - salariedHoursUsed - commissionHoursUsed)

salariedRev          = salariedHoursUsed * revenueHourlyRate
// commission revenue is split across commission tiers proportional to each
// tier's remaining capacity, so each tier's commission uses its own rate
```

Commission pool becomes the sum over each tier of `tierRev * tier.commissionRate`. Sales commission unchanged (flat 15% applied once to all project revenue).

This naturally handles "priority assign to salaried, overflow to commission-only" that the user described, and per-tier rates flow through.

---

## 3. Capacity & hiring signal

A new "Capacity & hiring" panel below the roster, showing:

- **Total project hours needed** (from revenue ÷ hourly rate)
- **Per-engineer utilization bars** — for each tier, show `usedHours / capacity` as a colored bar (green ≤80%, amber 80–100%, red >100% which only happens during display rounding edge cases).
- **Headroom**: remaining salaried + commission hours after demand is met.
- **Hiring recommendation**:
  - if `unmetHours > 0`: red banner "Need ~X more engineering hours/month — hire ~ceil(unmetHours / 160) engineer(s)" plus an estimate of margin impact for adding 1 salaried vs 1 commission-only at default rates.
  - if utilization > 85% across all tiers: amber "Roster running hot — plan next hire".
  - else: muted "Capacity healthy".

---

## 4. Revenue inputs polish

The two revenue inputs already exist; keep them but:

- Surface them in the same panel as the new capacity readout so it's obvious that moving revenue moves the hiring signal.
- Show a small helper line: "At $X projected project revenue and $Y/hr blended rate, we need ~N billable hours/month".

Retainer revenue still flows to the math unchanged (used by commission-base toggles on tiers — keep the existing per-tier "applies to projects+retainers" option).

---

## 5. Files changed

**Modified**
- `lib/scaling-math.ts` — new tier list shape, capacity-based fill algorithm, `marginPct` preserved, new fields on `ScalingOutput`: `projectHoursNeeded`, `tierBreakdown[]`, `unmetHours`, `hiringRecommendation`.
- `components/founder/TeamScalingSimulator.tsx` — tier editors with add/remove, capacity panel with utilization bars, hiring banner, scenario-save migration for old shape.
- `components/founder/FounderDashboard.tsx` — only touched to pass through the new defaults; the dashboard projection model (`lib/founder-math.ts`) is **not** changed in this pass (it stays on the mix-based model so the rest of the page numbers don't shift).

**Not changed**
- `lib/founder-math.ts`, `app/(app)/founder/page.tsx`, Airtable schema, hero/scenario table/gap tiles.

## Out of scope

- Persisting roster tiers to Airtable.
- Applying the tiered roster to the dashboard-wide projections (today's pace, at-goal card, scenario table) — those keep using the simpler mix model for now. Easy to lift later once the tier UI proves itself.
