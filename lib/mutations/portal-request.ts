// Server Actions the CLIENT calls, from inside the portal.
//
// These are the only mutations in the codebase reachable by someone who is not
// an Airvues user, so every one of them:
//   1. resolves the portal session itself — no id is ever trusted from the form;
//   2. re-derives the retainer from that session rather than accepting one;
//   3. writes Submitted By / Author from the session, never from input.
//
// lib/mutations/retainer-request.ts is the OPS equivalent and gates on
// requireSignedIn(). It must never be called from a portal surface: a client
// has no ops session, and the two audiences do not share a gate.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, getRecord, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { getPortalSession } from "../portal-session";
import { getPortalData } from "../portal-data";
import { computeSlaDueAt } from "../retainer-policy";
import { listRetainerTiers } from "../retainers";
import type { RetainerPriority, RequestStatus } from "../retainer-types";

const REQ = Tables.RetainerRequests;
const CMT = Tables.RetainerRequestComments;

export type PortalResult<T = unknown> = ({ ok: true } & T) | { error: string };

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("retainers:requests");
  revalidateTag("retainers:comments");
}

export type SubmitRequestInput = {
  title: string;
  description: string;
  priority: RetainerPriority;
  /** Only consulted when the company holds more than one retainer. */
  retainerId?: string;
};

export async function submitPortalRequest(
  input: SubmitRequestInput,
): Promise<PortalResult<{ id: string }>> {
  const session = await getPortalSession();
  if (!session) return { error: "Your session has ended. Please open your sign-in link again." };

  const title = (input.title ?? "").trim();
  if (title.length < 3) return { error: "Please give the request a short title." };
  if (title.length > 200) return { error: "That title is too long — 200 characters at most." };

  try {
    const data = await getPortalData(session);
    if (data.retainers.length === 0) {
      return { error: "There is no active retainer on your account to file this against." };
    }

    // Derived from the session, never taken on trust. A supplied id is only
    // allowed to SELECT among this company's own retainers.
    const target =
      (input.retainerId && data.retainers.find((r) => r.agreement.id === input.retainerId)) ||
      data.retainers[0];

    // Uncached: SLA Due At is written once and never recalculated, so a stale
    // plan read here would leave this request without a deadline permanently.
    const tiers = await listRetainerTiers({ fresh: true });
    const tier = target.agreement.tierId
      ? (tiers.find((t) => t.id === target.agreement.tierId) ?? null)
      : null;

    const submittedAt = new Date();
    const dueAt = computeSlaDueAt(tier, input.priority, submittedAt);

    const [created] = await createRecords(REQ.id, [
      {
        fields: {
          Title: title,
          Retainer: [target.agreement.id],
          Company: [session.companyId],
          "Submitted By": [session.personId],
          Description: (input.description ?? "").trim(),
          "Client Priority": input.priority,
          Status: "Submitted" satisfies RequestStatus,
          "Submitted At": submittedAt.toISOString(),
          "SLA Due At": dueAt ? dueAt.toISOString() : null,
          "SLA Outcome": dueAt ? "Pending" : "Not covered",
        },
      },
    ]);

    invalidate();
    return { ok: true, id: created.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * A client reply on their own request.
 *
 * Deliberately does NOT stop the SLA clock. Only a first Airvues reply does
 * that — a client answering their own question must never mark their request
 * as responded to, which would erase a real breach.
 */
export async function addPortalComment(
  requestId: string,
  body: string,
): Promise<PortalResult> {
  const session = await getPortalSession();
  if (!session) return { error: "Your session has ended. Please open your sign-in link again." };

  const text = (body ?? "").trim();
  if (!text) return { error: "Write a message first." };

  try {
    // Ownership is proved by re-deriving the visible set, not by trusting the id.
    const data = await getPortalData(session);
    const request = data.requests.find((r) => r.id === requestId);
    if (!request) return { error: "That request could not be found on your account." };

    const rec = await getRecord<Record<string, unknown>>(REQ.id, requestId);
    const title = typeof rec.fields["Title"] === "string" ? rec.fields["Title"] : "request";
    const now = new Date();

    await createRecords(CMT.id, [
      {
        fields: {
          Label: `${title.slice(0, 40)} · Client · ${now.toISOString().slice(0, 10)}`,
          Request: [requestId],
          Author: [session.personId],
          "Author Side": "Client",
          Body: text,
          "Created At": now.toISOString(),
          "Visible to Client": true,
        },
      },
    ]);

    // Reopen a request the client comes back to, so a follow-up on something
    // marked Delivered does not sit unnoticed in a closed state.
    if (request.status === "Delivered" || request.status === "Closed") {
      await patchRecords(REQ.id, [
        { id: requestId, fields: { Status: "In Progress", "Closed At": null } },
      ]);
    }

    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
