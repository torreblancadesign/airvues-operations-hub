import { test } from "node:test";
import assert from "node:assert/strict";
import { currentPeriod, listPeriods } from "../lib/retainer-period";

const at = (iso: string) => new Date(iso);

test("currentPeriod returns null before the retainer starts", () => {
  // A signed-but-not-yet-effective retainer has no period to report hours
  // against. Without the start guard the anniversary walk returns a window
  // ending before the retainer begins.
  assert.equal(currentPeriod("2026-10-15", at("2026-09-10T12:00:00Z")), null);
});

test("currentPeriod opens on the effective date itself", () => {
  const p = currentPeriod("2026-09-10", at("2026-09-10T18:00:00Z"));
  assert.ok(p, "the first period starts on the effective date");
  assert.equal(p.start.toISOString().slice(0, 10), "2026-09-10");
});

test("currentPeriod anchors on the anniversary day, not the calendar month", () => {
  const p = currentPeriod("2026-01-15", at("2026-09-10T12:00:00Z"));
  assert.ok(p);
  // 10 Sept falls in the 15 Aug – 15 Sept window, not 1–30 Sept.
  assert.equal(p.start.toISOString().slice(0, 10), "2026-08-15");
  assert.equal(p.end.toISOString().slice(0, 10), "2026-09-15");
});

test("currentPeriod clamps an anchor day past the end of a short month", () => {
  const p = currentPeriod("2026-01-31", at("2026-02-20T12:00:00Z"));
  assert.ok(p);
  assert.equal(p.start.toISOString().slice(0, 10), "2026-01-31");
  // February has no 31st; the period ends on the last day it does have.
  assert.equal(p.end.toISOString().slice(0, 10), "2026-02-28");
});

test("currentPeriod returns null without an effective date", () => {
  assert.equal(currentPeriod(null, at("2026-09-10T12:00:00Z")), null);
});

test("listPeriods walks every anniversary up to now, newest first", () => {
  const ps = listPeriods("2026-06-15", at("2026-09-20T12:00:00Z"));
  assert.equal(ps.length, 4); // Jun, Jul, Aug, Sep
  assert.equal(ps[0].start.toISOString().slice(0, 10), "2026-09-15");
  assert.equal(ps[3].start.toISOString().slice(0, 10), "2026-06-15");
  // Newest period is the one currentPeriod reports.
  const cur = currentPeriod("2026-06-15", at("2026-09-20T12:00:00Z"));
  assert.ok(cur);
  assert.equal(ps[0].start.getTime(), cur.start.getTime());
  assert.equal(ps[0].end.getTime(), cur.end.getTime());
});

test("listPeriods is empty before the retainer starts and without a date", () => {
  assert.deepEqual(listPeriods("2026-10-15", at("2026-09-10T12:00:00Z")), []);
  assert.deepEqual(listPeriods(null, at("2026-09-10T12:00:00Z")), []);
});

test("listPeriods clamps a 31st anchor into short months", () => {
  // On Mar 5 the Mar-31 anniversary has not arrived, so the open period is
  // the one that started Feb 28 — Feb has no 31st, so the anchor clamps.
  const ps = listPeriods("2026-01-31", at("2026-03-05T12:00:00Z"));
  assert.equal(ps.length, 2);
  assert.equal(ps[0].start.toISOString().slice(0, 10), "2026-02-28");
  assert.equal(ps[0].end.toISOString().slice(0, 10), "2026-03-31");
});
