## Goal

Give the Team Scaling Simulator three new controls:
1. Reorder engineer tiers (priority for capacity fill).
2. Per-tier eligibility for project work vs retainer work.
3. Update an existing saved scenario instead of always creating a new one.

Scope: `lib/scaling-math.ts` and `components/founder/TeamScalingSimulator.tsx` only.

---

## 1. Tier prioritization

Today fills go salaried-array-order → commission-array-order. Make that order user-controlled.

- Keep the two arrays (`salariedEngineers`, `commissionOnlyEngineers`) — array order = priority.
- Add ▲ / ▼ buttons on each tier row in the simulator UI to swap with its neighbor within the same group.
- Salaried still fills before commission overall (matches the "use salaried capacity first" intent already established). Within each group, user-defined order rules.
- No math change needed beyond honoring array order (already does).

## 2. Per-tier eligibility: projects / retainers

Replace the existing `appliesTo: "projects" | "projects+retainers"` (which today only gates commission base) with two explicit eligibility flags that gate BOTH capacity fill AND commission base:

```
EngineerTier {
  ...
  worksOnProjects: boolean;   // eligible to be assigned project hours
  worksOnRetainers: boolean;  // eligible to be assigned retainer hours
  retainerCommission: boolean; // pay commission on retainer revenue serviced (replaces appliesTo)
}
```

Migration in `migrateInputs` / on read: derive
- `worksOnProjects = true` (legacy default)
- `worksOnRetainers = true` (legacy default — preserves today's behavior)
- `retainerCommission = appliesTo === "projects+retainers"`

Math changes in `computeScenario`:
- `fillTiers` takes the candidate tier list filtered by eligibility:
  - Retainer pass: only tiers with `worksOnRetainers`.
  - Project pass: only tiers with `worksOnProjects`.
- Tier commission calc uses `retainerCommission` instead of `appliesTo`.
- Marginal-rate calc for headroom also filters by `worksOnProjects`.

UI per tier row:
- Two compact checkboxes: "Projects" and "Retainers".
- The existing "Retainer commission" toggle stays, relabeled clearly.
- Guard: if a tier has `worksOnRetainers=false` it cannot earn retainer commission (UI disables the toggle).

Hiring signal: when `unmetRetainerHours > 0` and no tier has `worksOnRetainers`, the banner specifically says "No engineer tier is eligible for retainers — enable one or hire a dedicated retainer engineer."

## 3. Update saved scenario

Today `saveScenario` always appends. Add update + rename.

- Track `activeScenarioId: string | null` (the last loaded/saved scenario).
- `loadScenario(id)` sets active id and seeds `scenarioName` from the saved name.
- Replace the single "Save current" button with two:
  - **Update "<name>"** — visible when `activeScenarioId` exists and that scenario still exists; overwrites that scenario's `inputs` and `name`.
  - **Save as new** — always available; creates a new entry and sets it active.
- Scenario row in the table gets a small "active" dot when it matches `activeScenarioId`, plus an inline Rename action (uses current `scenarioName` input or a prompt — small, doesn't grow the row much).
- If the user edits inputs after loading, show a faint "modified" chip next to the Update button so it's obvious there are unsaved changes (compare `inputs` to the saved snapshot via JSON equality).

Storage key bumps to `founder:scaling-scenarios:v3` only if the SavedScenario shape changes; otherwise reuse v2 (the `inputs` migration handles the tier shape internally).

---

## Files touched

**Modified**
- `lib/scaling-math.ts` — `EngineerTier` gains `worksOnProjects` / `worksOnRetainers` / `retainerCommission`; `migrateInputs` v3→v3 (in-place tier shape migration); `computeScenario` filters fill lists by eligibility and reads `retainerCommission`; `makeTier` defaults both eligibilities to true.
- `components/founder/TeamScalingSimulator.tsx` — reorder ▲▼ buttons per tier; two eligibility checkboxes per tier; replace single Save with Update/Save-as-new + active-scenario tracking + modified indicator + rename.

**Not touched**
- `FounderDashboard.tsx`, `lib/founder-math.ts` — aggregate revenue contract unchanged.
- Airtable schema, other pages.

## Out of scope

- Per-retainer assignment to a specific tier (still priority-based within eligible tiers).
- Server-side persistence of scenarios (still localStorage).
- Drag-and-drop reordering (buttons only, keeps scope tight).