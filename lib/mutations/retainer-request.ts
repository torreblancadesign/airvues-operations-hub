// Server Actions for retainer requests and their comment threads.
//
// The SLA rule lives in exactly one place here — `recomputeOutcome` — and every
// write path goes through it. If it is ever inlined into a caller, the rule will
// drift between paths and breaches will be reported inconsistently.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, getRecord, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireSignedIn } from "../authz";
import { getAppSession } from "../session";
import { resolvePersonByEmail } from "../people";
import { listRetainerAgreements, listRetainerTiers } from "../retainers";
import { computeSlaDueAt, evaluateSlaOutcome } from "../retainer-policy";
import { logEventInternal } from "./project-log";
import type { CommentSide, RetainerPriority, RequestStatus } from "../retainer-types";

const REQ = Tables.RetainerRequests;
const CMT = Tables.RetainerRequestComments;
const STORY = Tables.Stories;

export type RequestMutationResult<T = unknown> = ({ ok: true } & T) | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireSignedIn();
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("retainers:requests");
  revalidateTag("retainers:comments");
}

async function currentPersonId(): Promise<string | null> {
  try {
    const session = await getAppSession();
    const person = await resolvePersonByEmail(session?.user?.email);
    return person?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Tier for a retainer agreement, or null when unlinked / unknown.
 *
 * Reads UNCACHED. `SLA Due At` is written once and never recalculated, so a
 * request created while the 5-minute cache still says "no SLA" would keep a
 * null deadline permanently and report "Not covered" forever. Writes are rare;
 * correctness beats a cache hit here.
 */
async function tierForRetainer(retainerId: string) {
  const [agreements, tiers] = await Promise.all([
    listRetainerAgreements({ fresh: true }),
    listRetainerTiers({ fresh: true }),
  ]);
  const agreement = agreements.find((a) => a.id === retainerId) ?? null;
  if (!agreement) return { agreement: null, tier: null };
  const tier = agreement.tierId ? (tiers.find((t) => t.id === agreement.tierId) ?? null) : null;
  return { agreement, tier };
}

/**
 * THE SLA RULE. Reads the request's current dates and writes the outcome.
 * A request with no deadline stays "Not covered" and can never become
 * "Breached" — that is what lets the product ship before tier SLAs are filled.
 */
async function recomputeOutcome(requestId: string): Promise<void> {
  const rec = await getRecord<Record<string, unknown>>(REQ.id, requestId);
  const dueRaw = rec.fields["SLA Due At"];
  const respRaw = rec.fields["First Responded At"];
  const dueAt = typeof dueRaw === "string" ? new Date(dueRaw) : null;
  const firstRespondedAt = typeof respRaw === "string" ? new Date(respRaw) : null;
  const outcome = evaluateSlaOutcome({ dueAt, firstRespondedAt, now: new Date() });
  await patchRecords(REQ.id, [{ id: requestId, fields: { "SLA Outcome": outcome } }]);
}

export type CreateRequestInput = {
  retainerId: string;
  title: string;
  description?: string;
  priority: RetainerPriority;
  submittedById?: string | null;
  /** ISO. Defaults to now. Lets ops back-date a request that arrived by email. */
  submittedAt?: string;
};

export async function createRetainerRequest(
  input: CreateRequestInput,
): Promise<RequestMutationResult<{ id: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const title = (input.title ?? "").trim();
  if (!title) return { error: "Title is required" };
  if (!input.retainerId?.startsWith("rec")) return { error: "A retainer must be selected" };

  try {
    const { agreement, tier } = await tierForRetainer(input.retainerId);
    if (!agreement) return { error: "Retainer not found, or it has no Company link." };

    const submittedAt = input.submittedAt ? new Date(input.submittedAt) : new Date();
    const dueAt = computeSlaDueAt(tier, input.priority, submittedAt);

    const fields: Record<string, unknown> = {
      Title: title,
      Retainer: [input.retainerId],
      // Tenant key, written explicitly — never derived downstream.
      Company: agreement.companyId ? [agreement.companyId] : [],
      "Client Priority": input.priority,
      Status: "Submitted" satisfies RequestStatus,
      "Submitted At": submittedAt.toISOString(),
      "SLA Due At": dueAt ? dueAt.toISOString() : null,
      "SLA Outcome": dueAt ? "Pending" : "Not covered",
    };
    if (input.description) fields["Description"] = input.description;
    if (input.submittedById) fields["Submitted By"] = [input.submittedById];

    const [created] = await createRecords(REQ.id, [{ fields }]);
    invalidate();
    await logEventInternal({
      projectId: input.retainerId,
      eventType: "Story created",
      detail: `Retainer request filed: ${title} (${input.priority})`,
    });
    return { ok: true, id: created.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type AddCommentInput = {
  requestId: string;
  body: string;
  side: CommentSide;
  /** Airvues-side only. Unchecked = internal note, hidden from the portal. */
  visibleToClient?: boolean;
};

export async function addRetainerComment(
  input: AddCommentInput,
): Promise<RequestMutationResult<{ id: string; stoppedClock: boolean }>> {
  const denied = await gate();
  if (denied) return denied;

  const body = (input.body ?? "").trim();
  if (!body) return { error: "Comment cannot be empty" };

  try {
    const authorId = await currentPersonId();
    const now = new Date();

    const req = await getRecord<Record<string, unknown>>(REQ.id, input.requestId);
    const title = typeof req.fields["Title"] === "string" ? req.fields["Title"] : "request";
    const alreadyResponded = typeof req.fields["First Responded At"] === "string";

    const label = `${title.slice(0, 40)} · ${input.side} · ${now.toISOString().slice(0, 10)}`;
    const [created] = await createRecords(CMT.id, [
      {
        fields: {
          Label: label,
          Request: [input.requestId],
          Author: authorId ? [authorId] : [],
          "Author Side": input.side,
          Body: body,
          "Created At": now.toISOString(),
          // Client messages are always visible to the client who wrote them.
          "Visible to Client":
            input.side === "Client" ? true : (input.visibleToClient ?? true),
        },
      },
    ]);

    // The first Airvues reply is what stops the SLA clock. An internal-only
    // note still counts — a human did respond; hiding it is a separate concern.
    let stoppedClock = false;
    if (input.side === "Airvues" && !alreadyResponded) {
      await patchRecords(REQ.id, [
        { id: input.requestId, fields: { "First Responded At": now.toISOString() } },
      ]);
      stoppedClock = true;
    }
    await recomputeOutcome(input.requestId);
    invalidate();
    return { ok: true, id: created.id, stoppedClock };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type UpdateRequestPatch = {
  status?: RequestStatus;
  assignedToId?: string | null;
  priority?: RetainerPriority;
};

export async function updateRetainerRequest(
  requestId: string,
  patch: UpdateRequestPatch,
): Promise<RequestMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    const rec = await getRecord<Record<string, unknown>>(REQ.id, requestId);
    const fields: Record<string, unknown> = {};

    if (patch.status !== undefined) {
      fields["Status"] = patch.status;
      const terminal = patch.status === "Closed" || patch.status === "Declined";
      // Stamp on entering a terminal state; clear it on reopening.
      fields["Closed At"] = terminal ? new Date().toISOString() : null;
    }
    if (patch.assignedToId !== undefined) {
      fields["Assigned To"] = patch.assignedToId ? [patch.assignedToId] : [];
    }
    if (patch.priority !== undefined) {
      fields["Client Priority"] = patch.priority;
      // Recompute the deadline from the ORIGINAL submit time, so the deadline
      // always reflects the response time agreed for the priority now assigned.
      const retainerId = Array.isArray(rec.fields["Retainer"])
        ? ((rec.fields["Retainer"] as string[])[0] ?? null)
        : null;
      const submittedRaw = rec.fields["Submitted At"];
      if (retainerId && typeof submittedRaw === "string") {
        const { tier } = await tierForRetainer(retainerId);
        const dueAt = computeSlaDueAt(tier, patch.priority, new Date(submittedRaw));
        fields["SLA Due At"] = dueAt ? dueAt.toISOString() : null;
      }
    }

    if (Object.keys(fields).length > 0) {
      await patchRecords(REQ.id, [{ id: requestId, fields }]);
    }
    await recomputeOutcome(requestId);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type TriageInput = {
  requestId: string;
  name: string;
  hours: number;
  invoice: number;
  assigneeIds?: string[];
};

/** Create a Story on the retainer's quote and link it back to the request. */
export async function triageRequestToStory(
  input: TriageInput,
): Promise<RequestMutationResult<{ storyId: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const name = (input.name ?? "").trim();
  if (!name) return { error: "Story name is required" };
  if (!Number.isFinite(input.hours) || input.hours <= 0) {
    return { error: "Hours must be a positive number" };
  }
  if (!Number.isFinite(input.invoice) || input.invoice < 0) {
    return { error: "Value must be 0 or greater" };
  }

  try {
    const rec = await getRecord<Record<string, unknown>>(REQ.id, input.requestId);
    const retainerId = Array.isArray(rec.fields["Retainer"])
      ? ((rec.fields["Retainer"] as string[])[0] ?? null)
      : null;
    if (!retainerId) return { error: "Request is not linked to a retainer." };

    const storyFields: Record<string, unknown> = {
      "Story Name": name,
      Hours: input.hours,
      // Both currency fields are kept in sync, matching createQuoteStory.
      Invoice: input.invoice,
      Cost: input.invoice,
      "Story Status": "Todo",
      Quote: [retainerId],
    };
    if (input.assigneeIds?.length) storyFields["Assignee"] = input.assigneeIds;

    const [story] = await createRecords(STORY.id, [{ fields: storyFields }]);

    const existing = Array.isArray(rec.fields["Stories"])
      ? (rec.fields["Stories"] as string[])
      : [];
    await patchRecords(REQ.id, [
      { id: input.requestId, fields: { Stories: [...existing, story.id] } },
    ]);

    invalidate();
    revalidateTag("engineering:stories");
    await logEventInternal({
      projectId: retainerId,
      eventType: "Story created",
      detail: `${name} · ${input.hours}h · from retainer request`,
    });
    return { ok: true, storyId: story.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
