// Portal overview.
//
// Every read goes through lib/portal-data.ts, which owns the tenant boundary.
//
// ROLE GATE: the monthly rate and agreed response windows are commercial terms
// of the agreement, and live on /portal/plan for Owners only.
//
// NO EMPTY METRICS. A figure with no data behind it is omitted, not rendered
// as an em-dash. The first build showed three dashes to a new client and read
// as broken rather than new.
import Link from "next/link";
import { getPortalSession } from "@/lib/portal-session";
import { portalSecretConfigured } from "@/lib/portal-token";
import { getPortalData } from "@/lib/portal-data";
import { OPEN_REQUEST_STATUSES } from "@/lib/retainer-types";
import { Meter, fmtHours, shortDate } from "@/components/portal/bits";
import { QueueList } from "@/components/portal/QueueList";

export const dynamic = "force-dynamic";

const DENIALS: Record<string, string> = {
  missing: "That link was incomplete. Ask your Airvues contact for a new one.",
  expired: "That sign-in link has expired — they last 30 minutes. Ask for a fresh one.",
  revoked: "Your access has been turned off. Please contact your Airvues account lead.",
  unknown: "We could not find your record. Please contact your Airvues account lead.",
  noclient: "Your account is not linked to a client yet. Please contact your account lead.",
  unconfigured: "Portal sign-in is not configured on this deployment.",
};

export default async function PortalHome({
  searchParams,
}: {
  searchParams?: { denied?: string; filed?: string };
}) {
  const session = await getPortalSession();

  if (!session) {
    const denied = searchParams?.denied;
    return (
      <div className="p-panel mx-auto max-w-[460px] p-8 text-center mt-10">
        <h1 className="t-h1">Your Airvues retainer</h1>
        <p className="t-body mt-3" style={{ lineHeight: 1.6 }}>
          {denied
            ? (DENIALS[denied] ?? DENIALS.expired)
            : "Open the one-time link your Airvues account lead sent you. There is no password to remember."}
        </p>
        {!portalSecretConfigured() && (
          <p className="t-small mt-4" style={{ color: "var(--p-warn)" }}>
            No signing secret is configured on this deployment.
          </p>
        )}
      </div>
    );
  }

  const now = new Date();
  const { retainers, requests, queue, record, requesterName, promisedHoursFor } =
    await getPortalData(session, now);

  const open = requests.filter((r) => r.status && OPEN_REQUEST_STATUSES.includes(r.status));
  const primary = retainers[0] ?? null;
  const included = primary?.includedHours ?? null;
  const used = primary?.hoursLogged ?? 0;
  const remaining = included === null ? null : Math.max(0, included - used);
  const daysLeft = primary?.periodEnd
    ? Math.max(0, Math.ceil((new Date(primary.periodEnd).getTime() - now.getTime()) / 86_400_000))
    : null;
  const measured = record.metCount + record.breachedCount;

  return (
    <>
      {searchParams?.filed && (
        <div
          className="p-panel mb-5 px-4 py-3"
          style={{ borderColor: "var(--p-ok)", background: "var(--p-ok-bg)" }}
        >
          <span style={{ color: "var(--p-ok)", fontWeight: 600 }}>Request received.</span>{" "}
          <span className="t-body">It has joined the queue below.</span>
        </div>
      )}

      <h1 className="t-h1">Overview</h1>
      <p className="t-small mt-1">
        {primary?.periodStart && primary?.periodEnd ? (
          <span className="fig">
            Billing period {shortDate(primary.periodStart)} – {shortDate(primary.periodEnd)}
            {daysLeft !== null && ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
          </span>
        ) : (
          "Your retainer at a glance."
        )}
      </p>

      {retainers.length === 0 ? (
        <div className="p-panel p-6 mt-6">
          <p className="t-body">
            There is no active retainer on your account yet. Your Airvues account lead can set
            one up.
          </p>
        </div>
      ) : (
        <section className="p-hero mt-6 p-6 sm:p-7">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <div className="t-label">Hours left this period</div>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span
                  className="t-hero"
                  style={{ color: remaining === 0 ? "var(--p-warn)" : "var(--p-ink)" }}
                >
                  {included === null ? "—" : fmtHours(remaining)}
                </span>
                {included !== null && (
                  <span className="fig t-body">of {fmtHours(included)} included</span>
                )}
              </div>
              {included !== null && (
                <div className="mt-4 max-w-[420px]">
                  <Meter value={used} max={included} />
                  <p className="t-fine mt-2">
                    Hours appear as work is logged, so very recent work may not show yet.
                  </p>
                </div>
              )}
            </div>

            {/* Supporting facts, recessed so the hero number keeps the weight. */}
            <div className="p-sunk p-4 grid grid-cols-2 sm:grid-cols-1 gap-4 sm:min-w-[190px]">
              <div>
                <div className="t-fine">Waiting on us</div>
                <div
                  className="t-num"
                  style={{
                    color: queue.some((q) => q.request.slaOutcome === "Breached")
                      ? "var(--p-bad)"
                      : undefined,
                  }}
                >
                  {queue.length}
                </div>
              </div>
              <div>
                <div className="t-fine">Open in total</div>
                <div className="t-num">{open.length}</div>
              </div>
              {record.answered > 0 && (
                <div>
                  <div className="t-fine">Typical first reply</div>
                  <div className="t-num">
                    {fmtHours(record.averageHours)}
                    <span className="t-fine" style={{ fontWeight: 500 }}>
                      {" "}
                      business hrs
                    </span>
                  </div>
                </div>
              )}
              {measured > 0 && (
                <div>
                  <div className="t-fine">Answered on time</div>
                  <div
                    className="t-num"
                    style={{ color: record.breachedCount > 0 ? "var(--p-warn)" : "var(--p-ok)" }}
                  >
                    {Math.round((record.metCount / measured) * 100)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="t-h2">In the queue</h2>
            <p className="t-fine mt-0.5">
              What your team is waiting on us for, in the order the promised times fall.
            </p>
          </div>
          {retainers.length > 0 && (
            <Link href="/portal/requests/new" className="p-btn p-btn-primary shrink-0">
              New request
            </Link>
          )}
        </div>

        <QueueList
          entries={queue.map((q) => ({
            id: q.request.id,
            title: q.request.title,
            position: q.position,
            priority: q.request.priority ?? "Medium",
            requestedBy:
              q.request.submittedById === session.personId
                ? "you"
                : (requesterName(q.request) ?? "your team"),
            askedOn: shortDate(q.request.submittedAt),
            waitedHours: q.waitedHours,
            promisedHours: promisedHoursFor(q.request),
            late: q.request.slaOutcome === "Breached",
          }))}
          emptyTitle={requests.length === 0 ? "Nothing filed yet" : "Nothing waiting on us"}
          emptyBody={
            requests.length === 0
              ? "When your team needs something, file it here instead of email. You will see exactly where it sits and when we replied."
              : "Everything open has had a first reply from us."
          }
          emptyAction={
            retainers.length > 0 && requests.length === 0
              ? { href: "/portal/requests/new", label: "File your first request" }
              : undefined
          }
        />

        {requests.length > queue.length && (
          <p className="t-small mt-3">
            <Link href="/portal/requests" className="hover:underline">
              See all {requests.length} requests →
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
