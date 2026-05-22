## Goal

Switch the scorecard off approximations now that the Airtable fields exist:
- `People.Annual Earnings Goal` (currency)
- `Stories.Completed Date` (date)

## Changes

**1. `lib/schema.ts`** — regenerate or hand-add field IDs for the two new fields so we reference them by ID, not by name. (Today `lib/scorecard.ts` reads `Annual Earnings Goal` by name as a fallback, which works but breaks the project's "always reference by ID via Tables.X.fields" rule from CLAUDE.md.)

Quickest path without re-running the generator: I add the two entries by hand, then run `scripts/verify-schema.ts` to confirm the IDs against the live Meta API. If you'd rather, tell me the two field IDs and I'll paste them in directly.

**2. `lib/engineering-types.ts` + `lib/engineering.ts`** — add `completedDate: string | null` to `Story`, fetch `Stories.Completed Date` in the existing story query, map it through.

**3. `lib/scorecard.ts`**
- Read `Annual Earnings Goal` by field ID (drop the name-based fallback + the `.catch(() => [])`).
- Replace the sprint-end approximation for YTD/MTD shipped: bucket `byStatus.done` by `story.completedDate` instead of `max(sprintEnds)`. Stories with no `completedDate` (legacy/historical completions) fall through to the sprint-end fallback so lifetime counts stay stable.
- Set `shippedIsApproximate: false` when every completed story has a real `completedDate`; otherwise keep `true` and the UI keeps the small caveat.

**4. `components/me/PersonScorecard.tsx`** — no structural changes. The "approximated from sprint end dates" aside only renders when `shippedIsApproximate` is true, so it'll disappear automatically once every completed story has a date.

## Optional, recommended (not in this pass unless you say so)

Add an Airtable automation: **when `Story Status` changes to `Completed`, set `Completed Date` = today**. Without it, the field only fills for stories shipped *after* you start setting it manually. I can write the automation spec if you want.

## Verification

- `npx tsc --noEmit`
- Load `/me?as=<your-id>`: confirm goal bar reads from Airtable, YTD/MTD shipped counts match what you expect.
- Pick someone with `Annual Earnings Goal` unset → still shows the "set a goal" placeholder.

## Open question

Should I also add an Airtable automation spec for auto-populating `Completed Date`, or are you handling that separately?
