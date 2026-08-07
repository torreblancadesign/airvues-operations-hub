// Business-day arithmetic for retainer SLA deadlines.
//
// PURE MODULE — no I/O, no dependencies, no Next, no Airtable. This file is
// duplicated verbatim into airvues-retainer-portal; keep it that way.
//
// Window: 09:00-18:00 Mon-Fri in America/Los_Angeles (IANA, so DST is handled).
// A deadline landing exactly on 18:00 STAYS at 18:00 — it does not roll to the
// next morning, which would gift an extra overnight on every exact multiple.

export const TZ = "America/Los_Angeles";
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18;

/** Airvues holidays, as YYYY-MM-DD in TZ. Update yearly. */
export const HOLIDAYS: string[] = ["2026-01-01", "2026-07-03", "2026-11-26", "2026-12-25"];

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DTF = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Wall-clock parts of an instant, as seen in TZ. */
export function zonedParts(d: Date): Parts {
  const m: Record<string, string> = {};
  for (const p of DTF.formatToParts(d)) if (p.type !== "literal") m[p.type] = p.value;
  return {
    year: +m.year,
    month: +m.month,
    day: +m.day,
    // Intl emits "24" for midnight under hour12:false; normalise to 0.
    hour: +m.hour % 24,
    minute: +m.minute,
    second: +m.second,
  };
}

function offsetMs(d: Date): number {
  const p = zonedParts(d);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - d.getTime();
}

/**
 * TZ wall-clock -> UTC instant. Two-pass: the first offset lookup can be wrong
 * across a DST transition, so we re-resolve against the corrected instant.
 */
export function fromZoned(y: number, mo: number, d: number, h: number, mi = 0): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const o1 = offsetMs(new Date(guess));
  let ts = guess - o1;
  const o2 = offsetMs(new Date(ts));
  if (o2 !== o1) ts = guess - o2;
  return new Date(ts);
}

/** YYYY-MM-DD of an instant, as seen in TZ. */
export function isoDate(d: Date): string {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function weekdayIndex(d: Date): number {
  const p = zonedParts(d);
  // Date-only value read back in UTC — no timezone conversion involved.
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

export function isBusinessDay(d: Date): boolean {
  const wd = weekdayIndex(d);
  if (wd === 0 || wd === 6) return false;
  return !HOLIDAYS.includes(isoDate(d));
}

function dayWindow(d: Date): { open: Date; close: Date } {
  const p = zonedParts(d);
  return {
    open: fromZoned(p.year, p.month, p.day, DAY_START_HOUR),
    close: fromZoned(p.year, p.month, p.day, DAY_END_HOUR),
  };
}

function nextDayStart(d: Date): Date {
  const p = zonedParts(d);
  // Calendar arithmetic ONLY. Date.UTC handles month/year rollover and we read
  // it back with getUTC* so no conversion happens. Converting a UTC-midnight
  // instant into TZ wall-clock lands on the PREVIOUS local day — that bug made
  // every rollover case silently return the wrong day.
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return fromZoned(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), DAY_START_HOUR);
}

/** Move an instant forward to the next moment inside the business window. */
export function clampToBusiness(d: Date): Date {
  let cur = d;
  for (let i = 0; i < 400; i++) {
    if (!isBusinessDay(cur)) {
      cur = nextDayStart(cur);
      continue;
    }
    const { open, close } = dayWindow(cur);
    if (cur < open) return open;
    if (cur >= close) {
      cur = nextDayStart(cur);
      continue;
    }
    return cur;
  }
  throw new Error("clampToBusiness: no business day found within 400 iterations");
}

/** start + `hours` business hours. Non-positive `hours` clamps to the window. */
export function addBusinessHours(start: Date, hours: number): Date {
  if (!(hours > 0)) return clampToBusiness(start);
  let cur = clampToBusiness(start);
  let remaining = hours * 3_600_000;
  for (let i = 0; i < 4000; i++) {
    const { close } = dayWindow(cur);
    const avail = close.getTime() - cur.getTime();
    // `<=` keeps an exact-boundary result at close rather than rolling it.
    if (remaining <= avail) return new Date(cur.getTime() + remaining);
    remaining -= avail;
    cur = clampToBusiness(close);
  }
  throw new Error("addBusinessHours: exceeded iteration budget");
}

/** Business hours elapsed between two instants. 0 if end <= start. */
export function businessHoursBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let cur = clampToBusiness(start);
  let total = 0;
  for (let i = 0; i < 4000; i++) {
    if (cur >= end) break;
    const { close } = dayWindow(cur);
    const segEnd = close < end ? close : end;
    if (segEnd > cur) total += segEnd.getTime() - cur.getTime();
    if (close >= end) break;
    cur = clampToBusiness(close);
  }
  return total / 3_600_000;
}
