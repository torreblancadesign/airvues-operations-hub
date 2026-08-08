// Pure aggregation for the /retainers health board.
//
// NO I/O. `now` is a parameter, never `new Date()` internally — otherwise this
// cannot be tested and the board becomes unverifiable.

import { businessHoursBetween } from "./retainer-sla";
import { slaRiskRatio } from "./retainer-policy";
import { currentPeriod } from "./retainer-period";
import {
  OPEN_REQUEST_STATUSES,
  type RetainerAgreement,
  type RetainerBoardRow,
  type RetainerRequest,
  type RetainerTier,
} from "./retainer-types";

/** Fraction of the SLA window elapsed at which a request is "at risk". */
export const AT_RISK_THRESHOLD = 0.75;

function isOpen(r: RetainerRequest): boolean {
  return r.status !== null && OPEN_REQUEST_STATUSES.includes(r.status);
}

export function buildBoardRows(args: {
  agreements: RetainerAgreement[];
  tiers: RetainerTier[];
  requests: RetainerRequest[];
  hoursByRetainer: Record<string, number>;
  now: Date;
}): RetainerBoardRow[] {
  const { agreements, tiers, requests, hoursByRetainer, now } = args;
  const tierById = new Map(tiers.map((t) => [t.id, t]));

  const byRetainer = new Map<string, RetainerRequest[]>();
  for (const r of requests) {
    if (!r.retainerId) continue;
    const list = byRetainer.get(r.retainerId);
    if (list) list.push(r);
    else byRetainer.set(r.retainerId, [r]);
  }

  const rows = agreements.map((a): RetainerBoardRow => {
    const tier = a.tierId ? (tierById.get(a.tierId) ?? null) : null;
    const mine = byRetainer.get(a.id) ?? [];
    const open = mine.filter(isOpen);
    const period = currentPeriod(a.effectiveDate, now);

    let breachedNowCount = 0;
    let atRiskCount = 0;
    let oldestUnansweredHours: number | null = null;

    for (const r of open) {
      const submittedAt = r.submittedAt ? new Date(r.submittedAt) : null;
      const dueAt = r.slaDueAt ? new Date(r.slaDueAt) : null;
      const answered = !!r.firstRespondedAt;

      if (!answered && submittedAt) {
        const waited = businessHoursBetween(submittedAt, now);
        if (oldestUnansweredHours === null || waited > oldestUnansweredHours) {
          oldestUnansweredHours = waited;
        }
      }

      // No deadline => "Not covered". Never breached, never at risk.
      if (!dueAt || answered) continue;

      if (now > dueAt) {
        breachedNowCount += 1;
      } else if (submittedAt) {
        const ratio = slaRiskRatio({ submittedAt, dueAt, now });
        if (ratio !== null && ratio >= AT_RISK_THRESHOLD) atRiskCount += 1;
      }
    }

    // Breached at any point this period, whether or not it was answered later.
    const breachedThisPeriodCount = mine.filter((r) => {
      if (r.slaOutcome !== "Breached") return false;
      if (!period || !r.submittedAt) return true;
      const at = new Date(r.submittedAt);
      return at >= period.start && at < period.end;
    }).length;

    const severity =
      breachedNowCount * 1000 + atRiskCount * 100 + (oldestUnansweredHours ?? 0);

    return {
      retainerId: a.id,
      projectName: a.projectName,
      companyId: a.companyId,
      companyName: a.companyName,
      tierName: tier?.name ?? null,
      slaLabel: tier?.slaLabel ?? null,
      subscriptionActive: a.subscriptionActive,
      openCount: open.length,
      breachedNowCount,
      atRiskCount,
      breachedThisPeriodCount,
      oldestUnansweredHours,
      includedHours: a.includedHours ?? tier?.includedHours ?? null,
      hoursLoggedThisPeriod: hoursByRetainer[a.id] ?? null,
      periodStart: period ? period.start.toISOString() : null,
      periodEnd: period ? period.end.toISOString() : null,
      severity,
    };
  });

  return rows.sort(
    (x, y) => y.severity - x.severity || x.projectName.localeCompare(y.projectName),
  );
}

/**
 * Requests whose SLA Due At must be recomputed after a plan's SLA hours change.
 *
 * SLA Due At is stamped once at creation and never recalculated, so a request
 * filed while its plan had no SLA keeps a null deadline permanently. Filling
 * the plan in later has to reach back and fix those, or the feature ships inert.
 *
 * Deliberately excludes answered requests: a reply that met a 4-hour promise
 * must not become a breach because the promise was later tightened to 2. It
 * also needs `submittedAt` — the deadline is computed forward from it, and
 * there is nothing to compute from without it.
 */
export function requestsNeedingSlaRecompute(
  requests: RetainerRequest[],
  retainerIds: string[],
): RetainerRequest[] {
  const wanted = new Set(retainerIds);
  return requests.filter(
    (r) =>
      r.retainerId !== null &&
      wanted.has(r.retainerId) &&
      isOpen(r) &&
      !r.firstRespondedAt &&
      !!r.submittedAt,
  );
}
