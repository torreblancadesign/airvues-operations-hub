// Server-only Airtable reads for retainer requests.
// Do NOT import from a client component.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { currentPeriod } from "./retainers";
import type {
  RetainerPriority,
  RequestStatus,
  RetainerRequest,
  SlaOutcome,
} from "./retainer-types";

const REQ = Tables.RetainerRequests;
const STORY = Tables.Stories;
const QUOTE = Tables.Quotes;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function firstLink(v: unknown): string | null {
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
}
function links(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function listRetainerRequests(): Promise<RetainerRequest[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    REQ.id,
    {
      fields: [
        REQ.fields["Title"].id,
        REQ.fields["Retainer"].id,
        REQ.fields["Company"].id,
        REQ.fields["Submitted By"].id,
        REQ.fields["Client Priority"].id,
        REQ.fields["Status"].id,
        REQ.fields["Submitted At"].id,
        REQ.fields["SLA Due At"].id,
        REQ.fields["First Responded At"].id,
        REQ.fields["SLA Outcome"].id,
        REQ.fields["Assigned To"].id,
        REQ.fields["Stories"].id,
        REQ.fields["Closed At"].id,
      ],
    },
    ["retainers:requests"],
  );

  return rows.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      title: str(f["Title"]) ?? "(untitled)",
      retainerId: firstLink(f["Retainer"]),
      companyId: firstLink(f["Company"]),
      submittedById: firstLink(f["Submitted By"]),
      priority: (str(f["Client Priority"]) as RetainerPriority | null) ?? null,
      status: (str(f["Status"]) as RequestStatus | null) ?? null,
      submittedAt: str(f["Submitted At"]),
      slaDueAt: str(f["SLA Due At"]),
      firstRespondedAt: str(f["First Responded At"]),
      slaOutcome: (str(f["SLA Outcome"]) as SlaOutcome | null) ?? null,
      assignedToId: firstLink(f["Assigned To"]),
      storyIds: links(f["Stories"]),
      closedAt: str(f["Closed At"]),
    };
  });
}

/**
 * Sum of Stories.Hours per retainer quote, for stories whose Completed Date
 * falls inside that retainer's current anniversary period.
 *
 * CAVEAT: Stories are frequently back-filled weeks after the work — a low
 * number means "not logged yet", not "not worked". Label it as such in any UI.
 */
export async function hoursByRetainerInPeriod(
  retainerIds: string[],
  now: Date,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (retainerIds.length === 0) return out;

  const quotes = await listRecordsCached<Record<string, unknown>>(
    QUOTE.id,
    { fields: [QUOTE.fields["Retainer Effective Date"].id] },
    ["retainers:agreements"],
  );
  const effectiveById = new Map(
    quotes.map((q) => [q.id, str(q.fields["Retainer Effective Date"])]),
  );

  const stories = await listRecordsCached<Record<string, unknown>>(
    STORY.id,
    {
      fields: [
        STORY.fields["Quote"].id,
        STORY.fields["Hours"].id,
        STORY.fields["Completed Date"].id,
      ],
      filterByFormula: `AND({Story Status} = 'Completed', {Completed Date} != BLANK())`,
    },
    ["retainers:period-hours"],
  );

  const wanted = new Set(retainerIds);
  for (const s of stories) {
    const quoteId = firstLink(s.fields["Quote"]);
    if (!quoteId || !wanted.has(quoteId)) continue;
    const completed = str(s.fields["Completed Date"]);
    if (!completed) continue;
    const period = currentPeriod(effectiveById.get(quoteId) ?? null, now);
    if (!period) continue;
    const when = new Date(`${completed}T12:00:00Z`);
    if (when < period.start || when >= period.end) continue;
    const hours = typeof s.fields["Hours"] === "number" ? (s.fields["Hours"] as number) : 0;
    out[quoteId] = (out[quoteId] ?? 0) + hours;
  }
  return out;
}
