import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoardRows } from "../lib/retainer-board";
import { fromZoned } from "../lib/retainer-sla";
import type { RetainerAgreement, RetainerRequest, RetainerTier } from "../lib/retainer-types";

const NOW = fromZoned(2026, 8, 6, 14, 0);

const platinum: RetainerTier = {
  id: "tier1",
  name: "Platinum",
  rank: 5,
  active: true,
  custom: false,
  customForCompanyId: null,
  includedHours: 45,
  monthlyRate: 6750,
  slaHours: { Urgent: 2, High: 4, Medium: 8, Low: 16 },
  slaLabel: "Same business day",
  maxUrgentPerMonth: 4,
  clientDescription: null,
};

const blankTier: RetainerTier = {
  ...platinum,
  id: "tier2",
  name: "Bronze",
  slaHours: { Urgent: null, High: null, Medium: null, Low: null },
};

const agreement: RetainerAgreement = {
  id: "q1",
  projectName: "Gracie Barra Retainer",
  companyId: "co1",
  companyName: "Gracie Barra",
  contactName: "Flavio Almeida",
  tierId: "tier1",
  monthlyRate: 6750,
  includedHours: 45,
  termMonths: 3,
  effectiveDate: "2026-06-16",
  subscriptionActive: true,
  dealStatus: "Approved and Signed",
};

function req(over: Partial<RetainerRequest>): RetainerRequest {
  return {
    id: "r1",
    title: "t",
    retainerId: "q1",
    companyId: "co1",
    submittedById: null,
    priority: "High",
    status: "Submitted",
    submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
    slaDueAt: fromZoned(2026, 8, 6, 14, 0).toISOString(),
    firstRespondedAt: null,
    slaOutcome: "Pending",
    assignedToId: null,
    storyIds: [],
    closedAt: null,
    ...over,
  };
}

const base = { agreements: [agreement], tiers: [platinum], hoursByRetainer: {}, now: NOW };

test("a retainer with no requests still gets a row", () => {
  const rows = buildBoardRows({ ...base, requests: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].openCount, 0);
  assert.equal(rows[0].severity, 0);
});

test("resolves tier name and SLA label onto the row", () => {
  const rows = buildBoardRows({ ...base, requests: [] });
  assert.equal(rows[0].tierName, "Platinum");
  assert.equal(rows[0].slaLabel, "Same business day");
});

test("counts open requests and excludes Closed and Declined", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [
      req({ id: "a", status: "Submitted" }),
      req({ id: "b", status: "In Progress" }),
      req({ id: "c", status: "Closed" }),
      req({ id: "d", status: "Declined" }),
    ],
  });
  assert.equal(rows[0].openCount, 2);
});

test("an unanswered request past its deadline counts as breached now", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", slaDueAt: fromZoned(2026, 8, 6, 11, 0).toISOString() })],
  });
  assert.equal(rows[0].breachedNowCount, 1);
  assert.equal(rows[0].atRiskCount, 0);
});

test("an unanswered request past 75 percent of its window is at risk", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [
      req({
        id: "a",
        submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
        slaDueAt: fromZoned(2026, 8, 6, 15, 0).toISOString(),
      }),
    ],
  });
  assert.equal(rows[0].atRiskCount, 1);
  assert.equal(rows[0].breachedNowCount, 0);
});

test("an answered request is neither at risk nor breached now", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [
      req({
        id: "a",
        slaDueAt: fromZoned(2026, 8, 6, 11, 0).toISOString(),
        firstRespondedAt: fromZoned(2026, 8, 6, 10, 30).toISOString(),
      }),
    ],
  });
  assert.equal(rows[0].breachedNowCount, 0);
  assert.equal(rows[0].atRiskCount, 0);
});

test("a Not covered request is never breached or at risk", () => {
  const rows = buildBoardRows({
    ...base,
    tiers: [blankTier],
    agreements: [{ ...agreement, tierId: "tier2" }],
    requests: [req({ id: "a", slaDueAt: null, slaOutcome: "Not covered" })],
  });
  assert.equal(rows[0].breachedNowCount, 0);
  assert.equal(rows[0].atRiskCount, 0);
  assert.equal(rows[0].openCount, 1);
});

test("a retainer with no tier linked still renders, with null tier name", () => {
  const rows = buildBoardRows({ ...base, agreements: [{ ...agreement, tierId: null }], requests: [] });
  assert.equal(rows[0].tierName, null);
  assert.equal(rows[0].slaLabel, null);
});

test("oldest unanswered wait is measured in business hours", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString() })],
  });
  assert.equal(rows[0].oldestUnansweredHours, 4);
});

test("oldest unanswered is null when everything is answered", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", firstRespondedAt: fromZoned(2026, 8, 6, 11, 0).toISOString() })],
  });
  assert.equal(rows[0].oldestUnansweredHours, null);
});

test("period is the anniversary window, not the calendar month", () => {
  const rows = buildBoardRows({ ...base, requests: [] });
  assert.equal(rows[0].periodStart?.slice(0, 10), "2026-07-16");
  assert.equal(rows[0].periodEnd?.slice(0, 10), "2026-08-16");
});

test("logged hours pass through from the supplied map", () => {
  const rows = buildBoardRows({ ...base, requests: [], hoursByRetainer: { q1: 31.5 } });
  assert.equal(rows[0].hoursLoggedThisPeriod, 31.5);
});

test("breaches sort above at-risk, which sorts above quiet retainers", () => {
  const second = { ...agreement, id: "q2", projectName: "Quiet Co", companyId: "co2" };
  const rows = buildBoardRows({
    ...base,
    agreements: [second, agreement],
    requests: [req({ id: "a", slaDueAt: fromZoned(2026, 8, 6, 11, 0).toISOString() })],
  });
  assert.equal(rows[0].retainerId, "q1");
  assert.ok(rows[0].severity > rows[1].severity);
});

test("requests belonging to another retainer are not counted", () => {
  const rows = buildBoardRows({
    ...base,
    requests: [req({ id: "a", retainerId: "someone-else" })],
  });
  assert.equal(rows[0].openCount, 0);
});
