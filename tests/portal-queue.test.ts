import test from "node:test";
import assert from "node:assert/strict";

import { buildQueue, positionOf, responseRecord } from "../lib/portal-queue";
import { fromZoned } from "../lib/retainer-sla";
import type { RetainerRequest } from "../lib/retainer-types";

const NOW = fromZoned(2026, 8, 6, 14, 0);

function req(over: Partial<RetainerRequest> & { id: string }): RetainerRequest {
  return {
    title: "t",
    retainerId: "q1",
    companyId: "co1",
    submittedById: "p1",
    priority: "Medium",
    status: "Submitted",
    submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
    slaDueAt: fromZoned(2026, 8, 6, 18, 0).toISOString(),
    firstRespondedAt: null,
    slaOutcome: "Pending",
    assignedToId: null,
    storyIds: [],
    closedAt: null,
    ...over,
  };
}

test("buildQueue orders by deadline, not by submit time", () => {
  const older = req({
    id: "old",
    submittedAt: fromZoned(2026, 8, 3, 10, 0).toISOString(),
    slaDueAt: fromZoned(2026, 8, 7, 12, 0).toISOString(),
  });
  const urgent = req({
    id: "urgent",
    priority: "Urgent",
    submittedAt: fromZoned(2026, 8, 6, 9, 0).toISOString(),
    slaDueAt: fromZoned(2026, 8, 6, 13, 0).toISOString(),
  });
  assert.deepEqual(buildQueue([older, urgent], NOW).map((q) => q.request.id), ["urgent", "old"]);
});

test("buildQueue puts uncovered requests last", () => {
  const covered = req({ id: "covered" });
  const uncovered = req({ id: "uncovered", slaDueAt: null, slaOutcome: "Not covered" });
  assert.deepEqual(
    buildQueue([uncovered, covered], NOW).map((q) => q.request.id),
    ["covered", "uncovered"],
  );
});

test("buildQueue excludes anything already answered", () => {
  const answered = req({ id: "a", firstRespondedAt: fromZoned(2026, 8, 6, 11, 0).toISOString() });
  assert.deepEqual(buildQueue([answered], NOW), []);
});

test("buildQueue excludes closed and declined", () => {
  assert.deepEqual(
    buildQueue([req({ id: "c", status: "Closed" }), req({ id: "d", status: "Declined" })], NOW),
    [],
  );
});

test("buildQueue numbers positions from one and carries the requester", () => {
  const a = req({ id: "a", submittedById: "alice", slaDueAt: fromZoned(2026, 8, 6, 15, 0).toISOString() });
  const b = req({ id: "b", submittedById: "bob", slaDueAt: fromZoned(2026, 8, 6, 17, 0).toISOString() });
  const q = buildQueue([b, a], NOW);
  assert.deepEqual(q.map((x) => [x.position, x.requestedById]), [[1, "alice"], [2, "bob"]]);
});

test("buildQueue measures waiting in business hours", () => {
  const q = buildQueue([req({ id: "a", submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString() })], NOW);
  assert.equal(q[0].waitedHours, 4);
});

test("positionOf finds a queued request and returns null otherwise", () => {
  const q = buildQueue([req({ id: "a" })], NOW);
  assert.equal(positionOf(q, "a"), 1);
  assert.equal(positionOf(q, "nope"), null);
});

test("responseRecord reports nothing when nothing has been answered", () => {
  assert.deepEqual(responseRecord([req({ id: "a" })]), {
    answered: 0, averageHours: null, fastestHours: null, metCount: 0, breachedCount: 0,
  });
});

test("responseRecord averages only answered requests, never counting an open one as zero", () => {
  const answered = req({
    id: "a",
    submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
    firstRespondedAt: fromZoned(2026, 8, 6, 12, 0).toISOString(),
    slaOutcome: "Met",
  });
  const stillOpen = req({ id: "b" });
  const rec = responseRecord([answered, stillOpen]);
  assert.equal(rec.answered, 1);
  assert.equal(rec.averageHours, 2);
  assert.equal(rec.fastestHours, 2);
});

test("responseRecord separates met from breached", () => {
  const met = req({
    id: "m",
    submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
    firstRespondedAt: fromZoned(2026, 8, 6, 11, 0).toISOString(),
    slaOutcome: "Met",
  });
  const late = req({
    id: "l",
    submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
    firstRespondedAt: fromZoned(2026, 8, 6, 15, 0).toISOString(),
    slaOutcome: "Breached",
  });
  const rec = responseRecord([met, late]);
  assert.equal(rec.metCount, 1);
  assert.equal(rec.breachedCount, 1);
  assert.equal(rec.averageHours, 3);
});

test("an uncovered request counts toward the average but toward neither verdict", () => {
  const uncovered = req({
    id: "u",
    submittedAt: fromZoned(2026, 8, 6, 10, 0).toISOString(),
    firstRespondedAt: fromZoned(2026, 8, 6, 12, 0).toISOString(),
    slaDueAt: null,
    slaOutcome: "Not covered",
  });
  const rec = responseRecord([uncovered]);
  assert.equal(rec.answered, 1);
  assert.equal(rec.averageHours, 2);
  assert.equal(rec.metCount, 0);
  assert.equal(rec.breachedCount, 0);
});
