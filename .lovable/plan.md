## Goal
Surface the new Stories field **"Status (from 🔵 Team Task Payments)"** on the engineer scorecard so each person can see which of their completed stories have actually been paid and which are still queued.

## Where the value comes from
This is a lookup field on `Stories` rolling up the payment status from the linked Team Task Payments row(s). Values mirror `Team Task Payments.Status` (`Paid`, `Needs Payment`, possibly blank). A single story can have multiple payments, so we treat it as `string[]` and define:
- **Paid** → every non-empty value is `"Paid"`
- **Awaiting** → at least one `"Needs Payment"`
- **Unbilled** → array is empty (no payment record created yet)

## Changes

### 1. `lib/engineering.ts`
Load the new lookup on stories alongside the existing `Pay Status (from Quote)`:
- Add `"Status (from 🔵 Team Task Payments)"` to both `fields` arrays (the two story fetches at lines ~225 and the secondary one).
- Map to a new `taskPayStatus: string[]` on each story (read by name; no `schema.ts` regen needed for a lookup).

### 2. `lib/engineering-types.ts`
Add `taskPayStatus: string[]` to the `Story` type.

### 3. `lib/scorecard-types.ts`
Extend `ShippedBuckets` and add a payout breakdown:
```ts
type PayoutBreakdown = {
  paidCount: number;   paidCost: number;
  awaitingCount: number; awaitingCost: number;
  unbilledCount: number; unbilledCost: number;
};
```
Add `payout: PayoutBreakdown` to `Scorecard` (computed over `byStatus.done`).

### 4. `lib/scorecard.ts`
While iterating `byStatus.done` for the shipped buckets, also classify each story by `taskPayStatus` and tally counts + `cost`. Expose on the returned scorecard.

### 5. `components/me/PersonScorecard.tsx` (Stories model only)
Under the existing **Stories Shipped** section, add a 3-card row:
- **Paid out** (emerald) — `paidCount` shipped · `fmtMoney(paidCost × commissionPct)` commission realized
- **Awaiting payment** (amber) — `awaitingCount` shipped · `fmtMoney(awaitingCost × commissionPct)` queued
- **Unbilled** (neutral) — `unbilledCount` shipped · `fmtMoney(unbilledCost × commissionPct)` not yet on a payment row

Also reframe the existing **Earned commission** card sub-copy to clarify it's the *projection* from completed stories, distinct from the *actually paid* number above.

### 6. `components/engineering/StoryCard.tsx`
The existing pill currently reflects quote-level pay status. Add a tiny second pill (or replace when on `/me`) showing the story-level payout state:
- `Paid` → emerald
- `Awaiting` → amber
- (omit when unbilled / not completed to avoid noise)

This makes the All-Your-Stories grid scannable for "which of my shipped work am I still owed on."

## Out of scope
- No changes to the Sales-commission view (`commissionModel === "sales"`).
- No new mutations — read-only lookup.
- No change to the existing Earnings (real money from Team Task Payments) section — that already shows the cash-in side.

## Verification
`npx tsc --noEmit` + `npm run build`, then open `/me` for an engineer with a mix of paid/unpaid completed stories and confirm the three new cards sum to the lifetime-shipped count.