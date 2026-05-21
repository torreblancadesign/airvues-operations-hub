## Clarify conversion metrics + add YTD/MTD toggle to Firm Pulse

### Problem

Two issues today on the home Firm Pulse and Pipeline KPIs:

1. **"Quote → Sold" and "Quote → Paid" are confusing and overlapping.** The current "Sold" counts a signature as sold even before the client pays anything, which doesn't match how the team thinks about a sale. "Paid" overlaps because every Paid project also counts as Sold.
2. **Firm Pulse has no time window control.** Everything is YTD or lifetime. The team wants to flip between **YTD** and **MTD** without making the section taller.

### New metric definitions (single source of truth)

- **Sent** (denominator for both rates): any quote that left Draft — `Sent. Awaiting Approval.`, `Approved and Signed`, `Awaiting Payment`, `Project In Progress`, `Paid`, `Cancelled`, `Rejected`.
- **Sold** (project actually started — initial invoice paid): status in `Project In Progress` or `Paid`. *Changes from today: excludes `Approved and Signed` and `Awaiting Payment`.*
- **Paid** (fully completed, all invoices collected): status = `Paid`.

So the funnel reads: **Sent → Sold → Paid**, with Paid as a strict subset of Sold.

Tile labels + subs:
- **Quote → Sold** · `{sold}/{sent}` · "projects started"
- **Quote → Paid** · `{paid}/{sent}` · "fully collected"

### YTD / MTD toggle

A small segmented control in the Firm Pulse header: `[ YTD | MTD ]`. Default YTD. State is local (no URL param needed).

**Scope (time-bound tiles only — others remain point-in-time snapshots):**

| Tile | YTD/MTD aware? | Notes |
|---|---|---|
| Revenue (hero) | yes | Sum collected within window; target prorated (target × elapsed/total of window) for the progress bar and pace verdict |
| Booked | yes | Sum + count of won deals signed within window |
| Quote → Sold rate | yes | Numerator and denominator both filtered to quotes prepared within window |
| Open Pipeline | no | Live snapshot |
| MRR | no | Point-in-time |
| Active Work | no | Live snapshot |
| Open AR | no | Live snapshot |

When MTD is active, the affected tile eyebrows append "· MTD" so it's obvious which numbers shifted (e.g. "YTD Revenue · Collected" → "MTD Revenue · Collected").

### Changes

1. **`lib/firm-pulse.ts`**
   - `getFirmPulse()` accepts no args but returns both windows precomputed: `revenue`, `booked`, `conversion` each become `{ ytd, mtd }` shaped. Cheaper than a second fetch and the loop is already O(n).
   - Add `mtdStart` alongside `yearStart`. Loop tallies booked + sold/sent buckets per window.
   - Rewrite the sold/sent logic to the new definitions above. Drop the current `wonCount`-as-sold conflation.
   - Pace math runs twice with the appropriate prorated target.

2. **`components/home/FirmPulse.tsx`**
   - Add a `useState<"ytd"|"mtd">` toggle and a segmented control in the top-right of the hero section (above or inline with the hero tile's eyebrow row).
   - Hero, Booked, and Quote → Sold tiles read from `pulse.revenue[window]`, `pulse.booked[window]`, `pulse.conversion[window]`.
   - Eyebrows on those three tiles append `· MTD` when window is MTD.
   - Update Quote → Sold sub to `{sold} sold / {sent} sent` and tile description to "projects started".

3. **`components/pipeline/PipelineDashboard.tsx`**
   - Recompute KPIs with the new definitions: `soldCount` = In Progress + Paid; `paidCount` = Paid; denominator = sentWithLost.
   - Keep both tiles in the row 1 grid (`lg:grid-cols-6`). Update subs:
     - Quote → Sold: `{soldCount} started / {sent} sent`
     - Quote → Paid: `{paidCount} collected / {sent} sent`
   - No time toggle on Pipeline (out of scope — pipeline page already has its own date filters).

### Technical notes

- `Project In Progress` and `Paid` are exact strings from Airtable `Quotes.Status`. Already referenced elsewhere in `lib/firm-pulse.ts` so no new schema lookups needed.
- MTD window = first of current month, local time, to now. Use the same `daysSince` style math.
- Prorated MTD revenue target = `annualTarget × (daysIntoMonth / daysInMonth)` for pace verdict.
- Type change to `FirmPulse` is internal to `lib/firm-pulse.ts` and `components/home/FirmPulse.tsx` — no other consumers (verified: only `app/(app)/page.tsx` imports `getFirmPulse`, and it passes the result through).

### Out of scope

- Time-windowing pipeline/MRR/AR/Active.
- Custom date ranges (QTD, last 30d, etc.).
- Persisting toggle state across reloads.
- Per-preparer breakdowns.
