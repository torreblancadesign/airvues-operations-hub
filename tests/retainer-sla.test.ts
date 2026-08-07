import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessHours,
  businessHoursBetween,
  clampToBusiness,
  fromZoned,
  zonedParts,
} from "../lib/retainer-sla";

const fmt = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

test("mid-day add stays same day", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 10, 0), 4)), "2026-08-06 14:00");
});

test("Friday 17:00 + 4h rolls to Monday 12:00", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 7, 17, 0), 4)), "2026-08-10 12:00");
});

test("submitted before open clamps to 09:00", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 6, 0), 1)), "2026-08-06 10:00");
});

test("submitted after close rolls to next morning", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 23, 0), 2)), "2026-08-07 11:00");
});

test("weekend submission starts Monday", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 8, 12, 0), 1)), "2026-08-10 10:00");
});

test("spans DST spring-forward (2026-03-08)", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 3, 6, 17, 0), 4)), "2026-03-09 12:00");
});

test("spans DST fall-back (2026-11-01)", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 10, 30, 17, 0), 4)), "2026-11-02 12:00");
});

test("skips a holiday", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 12, 24, 17, 0), 2)), "2026-12-28 10:00");
});

test("deadline landing exactly at close stays at close, does not roll", () => {
  assert.equal(fmt(addBusinessHours(fromZoned(2026, 8, 6, 9, 0), 9)), "2026-08-06 18:00");
});

test("businessHoursBetween same day", () => {
  assert.equal(businessHoursBetween(fromZoned(2026, 8, 6, 10, 0), fromZoned(2026, 8, 6, 14, 30)), 4.5);
});

test("businessHoursBetween ignores the weekend", () => {
  assert.equal(businessHoursBetween(fromZoned(2026, 8, 7, 17, 0), fromZoned(2026, 8, 10, 12, 0)), 4);
});

test("businessHoursBetween round-trips addBusinessHours", () => {
  const s = fromZoned(2026, 8, 7, 16, 30);
  assert.equal(Math.round(businessHoursBetween(s, addBusinessHours(s, 6)) * 100) / 100, 6);
});

test("clampToBusiness is idempotent inside the window", () => {
  const d = fromZoned(2026, 8, 6, 11, 0);
  assert.equal(clampToBusiness(d).getTime(), d.getTime());
});

test("businessHoursBetween returns 0 when end precedes start", () => {
  assert.equal(businessHoursBetween(fromZoned(2026, 8, 6, 14, 0), fromZoned(2026, 8, 6, 10, 0)), 0);
});
