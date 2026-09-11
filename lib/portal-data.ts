// Every read the client portal makes.
//
// THE TENANT BOUNDARY LIVES HERE AND NOWHERE ELSE. Pages call these functions
// and never reach for listRetainerAgreements or listRetainerRequests directly,
// so "did this page remember to filter on Company?" is a question with exactly
// one answer site instead of one per route.
import "server-only";

import { cache } from "react";

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

export const companyNameFor = cache(async (companyId: string): Promise<string | null> => {
  const rows = await listRecordsCached<Record<string, unknown>>(
    Tables.Companies.id,
    { fields: [Tables.Companies.fields["Name"].id] },
    ["retainers:company-names"],
  );
  const row = rows.find((r) => r.id === companyId);
  const n = row?.fields["Name"];
  return typeof n === "string" && n.trim() !== "" ? n : null;
});

/**
 * The Airtable reads, deduplicated per request.
 *
 * React cache() keyed on the company, so a layout, a page and a nested helper
 * that each call getPortalData share ONE set of fetches instead of three. The
 * request detail page was previously loading the whole set twice on its own.
 */
const loadCore = cache(async (companyId: string) => {
  const [allAgreements, tiers, allRequests, names] = await Promise.all([
    listRetainerAgreements(),
    listRetainerTiers(),
    listRetainerRequests(),
    peopleNameById(),
  ]);
  return { allAgreements, tiers, allRequests, names };
});

export async function getPortalData(
  session: PortalSession,
  now: Date = new Date(),
): Promise<PortalData> {
  const { allAgreements, tiers, allRequests, names } = await loadCore(session.companyId);

  // --- boundary ---
  const mine = allAgreements.filter(
    (a) => a.companyId === session.companyId && !a.archived,
  );
  const myIds = new Set(mine.map((a) => a.id));

  const hours = await hoursByRetainerInPeriod([...myIds], now);

  // retainers[0] is the "primary": it drives the hours meter, the Plan page's
  // rate, and the default target for a new request. Non-archived is not the
  // same as live — a re-quote leaves the superseded proposal in this set, and
  // if it sorted first the client saw the wrong plan and filed against a dead
  // quote. Live subscriptions first, then most recently effective. Nothing is
  // hidden: an unsigned proposal is still the client's own record.
  const ordered = [...mine].sort(
    (a, b) =>
      Number(b.subscriptionActive) - Number(a.subscriptionActive) ||
      (b.effectiveDate ?? "").localeCompare(a.effectiveDate ?? ""),
  );

  const retainers: PortalRetainer[] = ordered.map((agreement) => {
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
