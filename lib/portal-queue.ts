// The client-visible work queue and response record. PURE — no I/O.
//
// Why a queue exists at all: a client team shares one retainer, so a member
// filing a request needs to see that two colleagues are already ahead of them.
// Without it, "why is this taking so long" has no answer except suspicion.

import { businessHoursBetween } from "./retainer-sla";
import { OPEN_REQUEST_STATUSES, type RetainerRequest } from "./retainer-types";

export type QueueEntry = {
  request: RetainerRequest;
  /** 1-based place in the queue of things we still owe a first reply on. */
  position: number;
  /** Business hours this has been waiting, so far. */
  waitedHours: number | null;
  /** Who on the client's team asked for it. Null when ops filed it for them. */
  requestedById: string | null;
};

function isOpen(r: RetainerRequest): boolean {
  return r.status !== null && OPEN_REQUEST_STATUSES.includes(r.status);
}

/**
 * Everything still awaiting a first Airvues reply, in the order the deadlines
 * actually fall.
 *
 * Ordered by SLA deadline, not by submit time. That is how an SLA-driven queue
 * genuinely gets worked — an Urgent filed this morning is due before a Low
 * filed last week — and it is derived from a date each request already carries
 * rather than being a claim about how the team behaves. Requests with no
 * deadline sort last: they are uncovered, so nothing is promised about them.
 */
export function buildQueue(requests: RetainerRequest[], now: Date): QueueEntry[] {
  return requests
    .filter((r) => isOpen(r) && !r.firstRespondedAt)
    .slice()
    .sort((a, b) => {
      const ad = a.slaDueAt;
      const bd = b.slaDueAt;
      if (ad && bd) return ad.localeCompare(bd) || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");
      if (ad) return -1;
      if (bd) return 1;
      return (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");
    })
    .map((request, i) => ({
      request,
      position: i + 1,
      waitedHours: request.submittedAt
        ? businessHoursBetween(new Date(request.submittedAt), now)
        : null,
      requestedById: request.submittedById,
    }));
}

/** How many entries sit ahead of this one, or null when it is not queued. */
export function positionOf(queue: QueueEntry[], requestId: string): number | null {
  const found = queue.find((q) => q.request.id === requestId);
  return found ? found.position : null;
}

export type ResponseRecord = {
  /** Requests answered at all — the sample these figures come from. */
  answered: number;
  /** Business hours to first reply, averaged. Null when nothing was answered. */
  averageHours: number | null;
  fastestHours: number | null;
  /** Answered within the promise. */
  metCount: number;
  /** Answered, but late. */
  breachedCount: number;
};

/**
 * What actually happened on requests we have answered.
 *
 * Counts only requests with BOTH a submit time and a first reply — an
 * unanswered request has no response time yet, and averaging it in as zero
 * would flatter the number, which principle 2 forbids. Requests with no
 * deadline count toward the average but toward neither met nor breached,
 * because nothing was promised about them.
 */
export function responseRecord(requests: RetainerRequest[]): ResponseRecord {
  const answered = requests.filter((r) => r.submittedAt && r.firstRespondedAt);
  if (answered.length === 0) {
    return { answered: 0, averageHours: null, fastestHours: null, metCount: 0, breachedCount: 0 };
  }

  const hours = answered.map((r) =>
    businessHoursBetween(new Date(r.submittedAt as string), new Date(r.firstRespondedAt as string)),
  );
  const total = hours.reduce((n, h) => n + h, 0);

  return {
    answered: answered.length,
    averageHours: total / answered.length,
    fastestHours: Math.min(...hours),
    metCount: answered.filter((r) => r.slaOutcome === "Met").length,
    breachedCount: answered.filter((r) => r.slaOutcome === "Breached").length,
  };
}
