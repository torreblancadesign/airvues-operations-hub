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

  // A retainer that has not started yet has no current period. Without this the
  // anniversary walk happily returns a window ENDING before the retainer
  // begins, and the portal shows a future client hours "used" in a period that
  // never happened.
  if (now < fromZoned(+m[1], +m[2], anchorDay, 0, 0)) return null;

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

/**
 * Every billing period from `effectiveDate` up to and including the one
 * containing `now`, newest first. Same anniversary anchoring as
 * {@link currentPeriod} — a period is [start, end).
 */
export function listPeriods(
  effectiveDate: string | null,
  now: Date,
): { start: Date; end: Date }[] {
  if (!effectiveDate) return [];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate);
  if (!m) return [];
  const anchorDay = +m[3];
  const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const startOf = (y: number, mo: number) =>
    fromZoned(y, mo, Math.min(anchorDay, daysInMonth(y, mo)), 0, 0);

  const out: { start: Date; end: Date }[] = [];
  let y = +m[1];
  let mo = +m[2];
  // ponytail: 50-year ceiling so a far-future clock can't spin the walk forever.
  for (let i = 0; i < 600; i++) {
    const start = startOf(y, mo);
    if (start > now) break;
    let ny = y;
    let nm = mo + 1;
    if (nm === 13) {
      nm = 1;
      ny += 1;
    }
    out.push({ start, end: startOf(ny, nm) });
    y = ny;
    mo = nm;
  }
  return out.reverse();
}
