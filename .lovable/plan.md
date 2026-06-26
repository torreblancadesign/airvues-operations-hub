## Goal

Model retainers separately from project work in the Team Scaling Simulator so capacity planning reflects that retainers consume engineering hours at a different (usually higher per-dollar) load than billable project work, and surface "we need a dedicated retainer/logistics engineer" as a hiring signal.

Scope is limited to the Founder simulator: `lib/scaling-math.ts` and `components/founder/TeamScalingSimulator.tsx`. No dashboard projections, no Airtable schema, no other pages.

---

## 1. Split the billable rate

Today `revenueHourlyRate` is shared. Split into:

- `projectHourlyRate` — used to convert project revenue → hours needed (today's behavior).
- Retainers no longer use an hourly rate at all for capacity. Instead, capacity comes from an explicit per-retainer hours commitment (see §2).

UI: rename the existing rate field to "Project billing rate ($/hr)". Remove the single blended rate.

---

## 2. Retainer roster (replaces the single retainer revenue number)

Replace `monthlyRetainerRevenue: number` with a list:

```
type Retainer = {
  id: string;
  label: string;            // "Acme support", "Beta logistics"
  monthlyRevenue: number;   // $/mo we bill them
  supportHoursPerMonth: number; // engineering hours we owe them
  appliesToCommission: boolean; // include this retainer in commission base?
};
ScalingInputs.retainers: Retainer[];
```

Derived totals:
- `monthlyRetainerRevenue = sum(r.monthlyRevenue)` (used everywhere the old field was used — totals, founder math, commission base)
- `retainerHoursNeeded = sum(r.supportHoursPerMonth)`

UI: a "Retainers" section with rows (label, $/mo, hrs/mo, commission toggle, remove) and "+ Add retainer".

Migration: legacy `monthlyRetainerRevenue > 0` becomes one row labeled "Existing retainers" with `supportHoursPerMonth = monthlyRetainerRevenue / projectHourlyRate` as a starting estimate the user can edit. v bumps to 3 with a `migrateInputs` branch.

---

## 3. Capacity fill: retainers first, then projects

Retainer support is contractual — model it as fixed demand that gets fulfilled before project work:

```
retainerHoursNeeded = sum(retainers.supportHoursPerMonth)
projectHoursNeeded  = monthlyProjectRevenue / projectHourlyRate
totalDemand         = retainerHoursNeeded + projectHoursNeeded
```

Fill order on the existing tier lists (salaried → commission-only, in array order):

1. Fill `retainerHoursNeeded` first across salaried tiers, then commission tiers.
2. Then fill `projectHoursNeeded` with whatever capacity remains.
3. `unmetRetainerHours` and `unmetProjectHours` tracked separately.

`TierBreakdown` gains `retainerHours` and `projectHours` (and keeps `usedHours = retainerHours + projectHours`) so the UI can show the split per tier.

---

## 4. Commission math

- Project revenue commission: unchanged — each tier's `projectHours * projectHourlyRate * commissionRate`.
- Retainer revenue commission: per retainer, if `appliesToCommission` is true, pay the commission to whichever engineer tier actually services it. Use the same proportional split we already use for tiers — distribute each retainer's revenue across tiers in proportion to retainer hours each tier covered for that retainer (computed during the fill).
- Sales (Client Solutions) commission: keep current behavior; the existing per-role `appliesTo: "projects" | "projects+retainers"` toggle continues to control whether retainer revenue is in the sales base.

---

## 5. Hiring signal upgrades

The signal already exists; extend it to call out retainer shortfalls explicitly:

- If `unmetRetainerHours > 0` → red banner: "Retainers under-served by ~X hrs/mo — hire a dedicated retainer/logistics engineer (~ceil(X/160))." Highest priority.
- Else if `unmetProjectHours > 0` → existing project-shortfall banner.
- Else amber/healthy as today, but utilization shown per tier already.

Also add a small per-retainer chip showing "covered" or "short by N hrs" next to each retainer row.

---

## 6. Files touched

**Modified**
- `lib/scaling-math.ts` — new `Retainer` type, `ScalingInputs.retainers`, `projectHourlyRate`, two-pass capacity fill, expanded `TierBreakdown` + `ScalingOutput` (`retainerHoursNeeded`, `unmetRetainerHours`, `unmetProjectHours`, per-retainer coverage), updated commission split, `defaultInputs` seeding one example retainer, `migrateInputs` v2→v3.
- `components/founder/TeamScalingSimulator.tsx` — rename rate input, add Retainers editor section, update capacity panel to show retainer vs project hours per tier, update hiring banner copy, per-retainer coverage chips.

**Not touched**
- `lib/founder-math.ts`, `FounderDashboard.tsx` math (still uses aggregate retainer revenue — the new sum is API-compatible).
- Airtable schema, other pages.

## Out of scope

- Persisting retainer roster to Airtable.
- Per-retainer SLA / response-time modeling.
- Auto-assigning a specific tier to a specific retainer (today it's just priority fill order).