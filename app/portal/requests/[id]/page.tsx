import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalData, getPortalRequest } from "@/lib/portal-data";
import { positionOf } from "@/lib/portal-queue";
import { PortalThread } from "@/components/portal/RequestThread";
import { Label, Pill, requestState, shortDate } from "@/components/portal/bits";

export const dynamic = "force-dynamic";

export default async function PortalRequestPage({ params }: { params: { id: string } }) {
  const session = await getPortalSession();
  if (!session) {
    return (
      <main className="mx-auto max-w-[980px] px-5 py-12">
        <div className="p-card p-8 text-center max-w-[520px] mx-auto">
          <p style={{ fontSize: 15 }}>
            Your session has ended.{" "}
            <Link href="/portal" style={{ textDecoration: "underline" }}>
              Start again
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  // Returns null for anything outside this company — an ordinary not-found,
  // which does not confirm whether the id exists elsewhere.
  const found = await getPortalRequest(session, params.id);
  if (!found) notFound();

  const { request, promisedHours, comments } = found;
  const isOwner = session.role === "Owner";
  // Members do not see the agreed response window, so tell them the thing they
  // can act on instead: where this sits behind their colleagues' requests.
  const { queue, requesterName } = await getPortalData(session);
  const queuePosition = positionOf(queue, request.id);
  const requestedBy =
    request.submittedById === session.personId ? "you" : (requesterName(request) ?? "your team");
  const state = requestState(request);
  const closed = request.status === "Closed" || request.status === "Delivered";

  return (
    <main className="mx-auto max-w-[760px] px-5 py-9 sm:py-12">
      <Link
        href="/portal"
        style={{ fontSize: 13.5, color: "var(--p-ink-2)" }}
        className="hover:underline"
      >
        ← All requests
      </Link>

      <div className="flex items-start justify-between gap-4 mt-4 flex-wrap">
        <h1
          style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.022em", lineHeight: 1.25 }}
          className="min-w-0"
        >
          {request.title}
        </h1>
        <div className="shrink-0 pt-1.5">
          <Pill tone={state.tone}>{state.label}</Pill>
        </div>
      </div>

      <div className="p-card mt-5 p-5 grid gap-5 sm:grid-cols-3">
        <div>
          <Label>Asked by</Label>
          <div style={{ fontSize: 15, marginTop: 2 }}>
            {requestedBy}
            <span className="fig" style={{ color: "var(--p-ink-3)" }}>
              {" "}
              · {shortDate(request.submittedAt)}
            </span>
          </div>
        </div>
        <div>
          <Label>Priority</Label>
          <div style={{ fontSize: 15, marginTop: 2 }}>{request.priority ?? "Medium"}</div>
        </div>
        <div>
          <Label>{request.firstRespondedAt ? "We replied" : "Status"}</Label>
          <div className="fig" style={{ fontSize: 15, marginTop: 2 }}>
            {request.firstRespondedAt ? (
              shortDate(request.firstRespondedAt)
            ) : isOwner ? (
              promisedHours !== null ? `within ${promisedHours} business hrs` : "not covered"
            ) : queuePosition !== null ? (
              `#${queuePosition} in your team's queue`
            ) : (
              "with the team"
            )}
          </div>
        </div>
      </div>

      {/* Only claim a promise was kept when the system actually measured it. */}
      {request.slaOutcome === "Met" && request.firstRespondedAt && (
        <p style={{ fontSize: 13.5, color: "var(--p-ok)", marginTop: 12 }}>
          We replied inside the response time on your plan.
        </p>
      )}
      {request.slaOutcome === "Breached" && (
        <p style={{ fontSize: 13.5, color: "var(--p-bad)", marginTop: 12 }}>
          We did not reply within the time we promised on this one.
        </p>
      )}

      <PortalThread requestId={request.id} comments={comments} closed={closed} />
    </main>
  );
}
