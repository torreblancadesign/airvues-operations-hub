## Goal
On the home page's "Your stories in flight" panel, replace dollar values with hours for consistency with the rest of the personal views.

## Changes — `components/home/YourDay.tsx`

**1. Stats strip (4-column row)**
- Replace `Open $` stat (currently `fmtMoney(day.totalOpenInvoice)`) with `Hours` showing total assigned hours across active stories.
- Drop the `wide` treatment so all 4 stats are equal width.

**2. Next-to-ship list rows**
- Remove the right-side dollar block (`fmtMoney(s.invoice)` invoice + `fmtMoney(s.commission)` commission).
- Replace with hours: primary = `s.hours` (assigned), secondary = `s.hoursWorked` ("Xh / Yh" style, or "Xh worked" if assigned is null).

**3. Cleanup**
- Remove the now-unused `fmtMoney` helper.

## Data — `lib/personal-landing.ts`

- Add `totalAssignedHours: number` and `totalHoursWorked: number` to `PersonalDay`, summed from `active` stories (treating null as 0).
- Keep existing `totalOpenInvoice` / `totalOpenCommission` fields in place for now (still consumed by the status line / potential future use); only the home UI stops rendering them.

## Out of scope
- Status line in `app/(app)/page.tsx` (no $ shown there).
- "Today's agenda" panel (no $ shown).
- Firm snapshot strip at the bottom — that's firm-level KPIs, dollars stay.
