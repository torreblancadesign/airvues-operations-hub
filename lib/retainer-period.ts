// Retainer billing-period math.
//
// PURE MODULE — no I/O, no Airtable, no Next. Split out of lib/retainers.ts
// (which is server-only) so that lib/retainer-board.ts can stay pure and
// therefore testable, and so this can be copied into the portal repo.

import { fromZoned, zonedParts } from "./retainer-sla";

/**
 * The billing period containing `now`, anchored on the anniversary day of
 * effectiveDate (NOT the calendar month) so hours stay aligned with the Stripe
 * subscription date. A day-of-month past the end of a short month clamps to
 * that month's last day.
 */
export function currentPeriod(
  effectiveDate: string | null,
  now: Date,
): { start: Date; end: Date } | null {
  if (!effectiveDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate);
  if (!m) return null;
  const anchorDay = +m[3];

  const p = zonedParts(now);
  const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const startOf = (y: number, mo: number) =>
    fromZoned(y, mo, Math.min(anchorDay, daysInMonth(y, mo)), 0, 0);

  let sy = p.year;
  let sm = p.month;
  if (now < startOf(sy, sm)) {
    sm -= 1;
    if (sm === 0) {
      sm = 12;
      sy -= 1;
    }
  }
  let ey = sy;
  let em = sm + 1;
  if (em === 13) {
    em = 1;
    ey += 1;
  }
  return { start: startOf(sy, sm), end: startOf(ey, em) };
}
