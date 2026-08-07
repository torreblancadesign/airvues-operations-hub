import { test } from "node:test";
import assert from "node:assert/strict";
import { fromZoned, zonedParts } from "../lib/retainer-sla";
import {
  computeSlaDueAt,
  evaluateSlaOutcome,
  slaHoursFor,
  slaRiskRatio,
} from "../lib/retainer-policy";
import type { RetainerTier } from "../lib/retainer-types";

const fmt = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

const platinum: RetainerTier = {
  id: "recIaQ8Q51Czl98x7",
  name: "Platinum",
  rank: 5,
  active: true,
  includedHours: 45,
  monthlyRate: 6750,
  slaHours: { Urgent: 2, High: 4, Medium: 8, Low: 16 },
  slaLabel: "Same business day",
  maxUrgentPerMonth: 4,
  clientDescription: null,
};

const unfilled: RetainerTier = {
  ...platinum,
  id: "recFGCeWFGWsHl8pn",
  name: "Bronze",
  rank: 1,
  slaHours: { Urgent: null, High: null, Medium: null, Low: null },
};

test("slaHoursFor reads the column matching the priority", () => {
  assert.equal(slaHoursFor(platinum, "Urgent"), 2);
  assert.equal(slaHoursFor(platinum, "Low"), 16);
});

test("slaHoursFor returns null when there is no tier", () => {
  assert.equal(slaHoursFor(null, "Urgent"), null);
});

test("slaHoursFor returns null when the tier column is blank", () => {
  assert.equal(slaHoursFor(unfilled, "Urgent"), null);
});

test("computeSlaDueAt adds business hours from the tier", () => {
  const due = computeSlaDueAt(platinum, "High", fromZoned(2026, 8, 6, 10, 0));
  assert.equal(fmt(due!), "2026-08-06 14:00");
});

test("computeSlaDueAt returns null for an unfilled tier", () => {
  assert.equal(computeSlaDueAt(unfilled, "Urgent", fromZoned(2026, 8, 6, 10, 0)), null);
});

test("computeSlaDueAt returns null when no tier is linked", () => {
  assert.equal(computeSlaDueAt(null, "Urgent", fromZoned(2026, 8, 6, 10, 0)), null);
});

test("no due date is Not covered, never Breached", () => {
  assert.equal(
    evaluateSlaOutcome({ dueAt: null, firstRespondedAt: null, now: fromZoned(2030, 1, 1, 12, 0) }),
    "Not covered",
  );
});

test("responded before the deadline is Met", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: fromZoned(2026, 8, 6, 11, 0),
      now: fromZoned(2026, 8, 6, 15, 0),
    }),
    "Met",
  );
});

test("responded exactly on the deadline is Met", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: fromZoned(2026, 8, 6, 14, 0),
      now: fromZoned(2026, 8, 6, 15, 0),
    }),
    "Met",
  );
});

test("responded after the deadline is Breached", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: fromZoned(2026, 8, 6, 16, 0),
      now: fromZoned(2026, 8, 6, 17, 0),
    }),
    "Breached",
  );
});

test("unanswered but still inside the deadline is Pending", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: null,
      now: fromZoned(2026, 8, 6, 12, 0),
    }),
    "Pending",
  );
});

test("unanswered past the deadline is Breached", () => {
  assert.equal(
    evaluateSlaOutcome({
      dueAt: fromZoned(2026, 8, 6, 14, 0),
      firstRespondedAt: null,
      now: fromZoned(2026, 8, 6, 16, 0),
    }),
    "Breached",
  );
});

test("slaRiskRatio is 0.5 at the halfway point", () => {
  const ratio = slaRiskRatio({
    submittedAt: fromZoned(2026, 8, 6, 10, 0),
    dueAt: fromZoned(2026, 8, 6, 14, 0),
    now: fromZoned(2026, 8, 6, 12, 0),
  });
  assert.equal(Math.round(ratio! * 100) / 100, 0.5);
});

test("slaRiskRatio is null when there is no deadline", () => {
  assert.equal(
    slaRiskRatio({
      submittedAt: fromZoned(2026, 8, 6, 10, 0),
      dueAt: null,
      now: fromZoned(2026, 8, 6, 12, 0),
    }),
    null,
  );
});

test("slaRiskRatio does not exceed 1 once overdue", () => {
  const ratio = slaRiskRatio({
    submittedAt: fromZoned(2026, 8, 6, 10, 0),
    dueAt: fromZoned(2026, 8, 6, 14, 0),
    now: fromZoned(2026, 8, 20, 14, 0),
  });
  assert.equal(ratio, 1);
});
