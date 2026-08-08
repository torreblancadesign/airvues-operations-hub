// Every read the client portal makes.
//
// THE TENANT BOUNDARY LIVES HERE AND NOWHERE ELSE. Pages call these functions
// and never reach for listRetainerAgreements or listRetainerRequests directly,
// so "did this page remember to filter on Company?" is a question with exactly
// one answer site instead of one per route.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { listRetainerAgreements, listRetainerTiers } from "./retainers";
import {
  hoursByRetainerInPeriod,
  listRetainerComments,
  listRetainerRequests,
  peopleNameById,
} from "./retainer-requests";
import { buildQueue, responseRecord, type QueueEntry, type ResponseRecord } from "./portal-queue";
import { currentPeriod } from "./retainer-period";
import { slaHoursFor } from "./retainer-policy";
import type {
  RetainerAgreement,
  RetainerComment,
  RetainerRequest,
  RetainerTier,
} from "./retainer-types";
import type { PortalSession } from "./portal-session";

export type PortalRetainer = {
  agreement: RetainerAgreement;
  tier: RetainerTier | null;
  includedHours: number | null;
  hoursLogged: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type PortalData = {
  retainers: PortalRetainer[];
  requests: RetainerRequest[];
  /** Still awaiting a first reply, in deadline order. */
  queue: QueueEntry[];
  /** What actually happened on the ones we have answered. */
  record: ResponseRecord;
  /** Who on the client's team filed a request. Ops-filed requests resolve to null. */
  requesterName: (r: RetainerRequest) => string | null;
  /** Response window actually promised for this request, in business hours. */
  promisedHoursFor: (r: RetainerRequest) => number | null;
};

export async function companyNameFor(companyId: string): Promise<string | null> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    Tables.Companies.id,
    { fields: [Tables.Companies.fields["Name"].id] },
    ["retainers:company-names"],
  );
  const row = rows.find((r) => r.id === companyId);
  const n = row?.fields["Name"];
  return typeof n === "string" && n.trim() !== "" ? n : null;
}

export async function getPortalData(
  session: PortalSession,
  now: Date = new Date(),
): Promise<PortalData> {
  const [allAgreements, tiers, allRequests] = await Promise.all([
    listRetainerAgreements(),
    listRetainerTiers(),
    listRetainerRequests(),
  ]);

  // --- boundary ---
  const mine = allAgreements.filter(
    (a) => a.companyId === session.companyId && !a.archived,
  );
  const myIds = new Set(mine.map((a) => a.id));

  const hours = await hoursByRetainerInPeriod([...myIds], now);

  const retainers: PortalRetainer[] = mine.map((agreement) => {
    const tier = agreement.tierId
      ? (tiers.find((t) => t.id === agreement.tierId) ?? null)
      : null;
    const period = currentPeriod(agreement.effectiveDate, now);
    return {
      agreement,
      tier,
      includedHours: agreement.includedHours ?? tier?.includedHours ?? null,
      hoursLogged: hours[agreement.id] ?? null,
      periodStart: period ? period.start.toISOString() : null,
      periodEnd: period ? period.end.toISOString() : null,
    };
  });

  // Belt and braces: filter on the company AND on the retainer set. A request
  // whose Company link drifted from its retainer's must not slip through.
  const requests = allRequests
    .filter(
      (r) =>
        r.companyId === session.companyId && r.retainerId !== null && myIds.has(r.retainerId),
    )
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

  const tierByRetainer = new Map(retainers.map((r) => [r.agreement.id, r.tier]));
  const names = await peopleNameById();

  return {
    retainers,
    requests,
    queue: buildQueue(requests, now),
    record: responseRecord(requests),
    requesterName: (r) => (r.submittedById ? (names.get(r.submittedById) ?? null) : null),
    promisedHoursFor: (r) =>
      r.retainerId && r.priority
        ? slaHoursFor(tierByRetainer.get(r.retainerId) ?? null, r.priority)
        : null,
  };
}

/**
 * One request plus its client-visible thread, or null when it does not belong
 * to this session's company. Returning null rather than throwing lets the page
 * render an ordinary not-found instead of confirming the id exists.
 */
export async function getPortalRequest(
  session: PortalSession,
  requestId: string,
  now: Date = new Date(),
): Promise<{
  request: RetainerRequest;
  retainer: PortalRetainer | null;
  promisedHours: number | null;
  comments: RetainerComment[];
} | null> {
  const data = await getPortalData(session, now);
  const request = data.requests.find((r) => r.id === requestId);
  if (!request) return null;

  const all = await listRetainerComments(requestId);
  return {
    request,
    retainer: data.retainers.find((r) => r.agreement.id === request.retainerId) ?? null,
    promisedHours: data.promisedHoursFor(request),
    // Internal notes never cross the boundary.
    comments: all.filter((c) => c.visibleToClient),
  };
}
