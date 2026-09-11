// Portal overview — the account statement.
//
// Every read goes through lib/portal-data.ts, which owns the tenant boundary.
//
// ROLE GATE: the monthly rate and the numeric response windows are commercial
// terms and live on /portal/plan for Owners only. The response chart shows
// performance AGAINST the promise without printing the promised figures.
//
// NO EMPTY METRICS. A figure with no data behind it is omitted, not rendered
// as an em-dash. When included hours are unknown the numeral becomes hours
// logged instead of a dash.
import Link from "next/link";
import { getPortalSession } from "@/lib/portal-session";
import { portalSecretConfigured } from "@/lib/portal-token";
import { getPortalData } from "@/lib/portal-data";
import { OPEN_REQUEST_STATUSES, type RetainerRequest } from "@/lib/retainer-types";
import { TZ, businessHoursBetween } from "@/lib/retainer-sla";
import { Meter, fmtHours, shortDate, requestState, toneInk } from "@/components/portal/bits";
import { QueueList } from "@/components/portal/QueueList";
import { ResponseChart, type ChartBar } from "@/components/portal/ResponseChart";

export const dynamic = "force-dynamic";

const DENIALS: Record<string, string> = {
  missing: "That link was incomplete. Ask your Airvues contact for a new one.",
  expired: "That sign-in link has expired — they last 30 minutes. Ask for a fresh one.",
  revoked: "Your access has been turned off. Please contact your Airvues account lead.",
  unknown: "We could not find your record. Please contact your Airvues account lead.",
  noclient: "Your account is not linked to a client yet. Please contact your account lead.",
  unconfigured: "Portal sign-in is not configured on this deployment.",
};

/** Greeting on the business timezone the rest of the retainer runs on. */
function greetingFor(now: Date): string {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TZ }).format(now),
  );
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

function initialsOf(name: string | null): string {
  if (!name) return "AV";
  const parts = name.trim().split(/\s+/);
  const two = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (two || "AV").toUpperCase();
}

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
  const isOwner = session.role === "Owner";
  const firstName = session.name === "there" ? null : session.name.split(/\s+/)[0];
  const tierName = primary?.tier?.name ?? null;

  // One bar per answered request that carried a promise, oldest first.
  const bars: ChartBar[] = requests
    .filter((r): r is RetainerRequest & { submittedAt: string; firstRespondedAt: string } =>
      Boolean(r.submittedAt && r.firstRespondedAt),
    )
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .flatMap((r) => {
      const promised = promisedHoursFor(r);
      if (promised === null || promised <= 0) return [];
      const took = businessHoursBetween(new Date(r.submittedAt), new Date(r.firstRespondedAt));
      return [
        {
          id: r.id,
          ratio: took / promised,
          late: r.slaOutcome === "Breached" || took > promised,
          label: `${r.title} — first reply in ${fmtHours(took)} business hours`,
        },
      ];
    })
    .slice(-14);

  const recent = requests.slice(0, 6);

  return (
    <>
      {searchParams?.filed && (
        <div
          className="p-panel mb-6 px-4 py-3"
          style={{ borderColor: "var(--p-ok)", background: "var(--p-ok-bg)" }}
        >
          <span style={{ color: "var(--p-ok)", fontWeight: 600 }}>Request received.</span>{" "}
          <span className="t-body">It has joined the queue below.</span>
        </div>
      )}

      {/* ---- masthead ---- */}
      <header>
        <h1 className="t-h1">
          {greetingFor(now)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="t-small mt-1 fig">
          {primary?.periodStart && primary?.periodEnd ? (
            <>
              {tierName ? `${tierName} plan · ` : ""}
              Billing period {shortDate(primary.periodStart)} – {shortDate(primary.periodEnd)}
              {daysLeft !== null && ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            </>
          ) : (
            "Your retainer, at a glance."
          )}
        </p>
      </header>

      {retainers.length === 0 ? (
        <div className="p-panel p-6 mt-6">
          <p className="t-body" style={{ lineHeight: 1.6 }}>
            There is no active retainer on your account yet. Your Airvues account lead can set
            one up — once it is live, your hours, queue and response record all appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ---- the statement band: what you bought, and how we did ---- */}
          <section className="p-hero mt-6 p-6 lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="min-w-0 lg:pr-8">
                <div className="t-label">
                  {included === null ? "Hours logged this period" : "Hours left this period"}
                </div>
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  <span
                    className="t-hero"
                    style={{ color: remaining === 0 ? "var(--p-warn)" : "var(--p-ink)" }}
                  >
                    {included === null ? fmtHours(used) : fmtHours(remaining)}
                  </span>
                  {included !== null && (
                    <span className="fig t-body">of {fmtHours(included)} included</span>
                  )}
                </div>
                {included !== null && (
                  <div className="mt-5">
                    <Meter value={used} max={included} />
                  </div>
                )}
                <p className="t-fine mt-3">
                  Hours appear as work is logged, so the newest work may not show yet.
                </p>
              </div>

              <div
                className="min-w-0 lg:border-l lg:pl-8"
                style={{ borderColor: "var(--p-line)" }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="t-label">Our response record</div>
                  {bars.length > 0 && (
                    <span className="t-fine fig">last {bars.length} answered</span>
                  )}
                </div>
                {bars.length > 0 ? (
                  <>
                    <div className="mt-3">
                      <ResponseChart bars={bars} />
                    </div>
                    <p className="t-small mt-3" style={{ lineHeight: 1.6 }}>
                      {measured > 0 && (
                        <>
                          <strong
                            className="fig"
                            style={{
                              color:
                                record.breachedCount > 0 ? "var(--p-warn)" : "var(--p-ok)",
                            }}
                          >
                            {Math.round((record.metCount / measured) * 100)}%
                          </strong>{" "}
                          answered on time
                        </>
                      )}
                      {record.averageHours !== null && (
                        <>
                          {measured > 0 && " · "}typical first reply{" "}
                          <strong className="fig" style={{ color: "var(--p-ink)" }}>
                            {fmtHours(record.averageHours)}
                          </strong>{" "}
                          business hours
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="t-small mt-3" style={{ lineHeight: 1.7, maxWidth: "40ch" }}>
                    Every request gets a promised first-reply time the moment it is filed. As
                    soon as we have answered your first one, how we did against that promise
                    shows here — kept in green, missed in red.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ---- the desk: queue beside the account's own activity ---- */}
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_336px] items-start">
            <section className="min-w-0">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h2 className="t-h2">In the queue</h2>
                  <p className="t-fine mt-0.5 fig">
                    {requests.length === 0
                      ? "What your team is waiting on us for will show here, in promise order."
                      : `${queue.length} waiting on a first reply · ${open.length} open in total`}
                  </p>
                </div>
                {requests.length > 0 && (
                  <Link href="/portal/requests/new" className="p-btn p-btn-primary shrink-0">
                    New request
                  </Link>
                )}
              </div>

              {requests.length === 0 ? (
                <div className="p-panel p-6">
                  <h3 style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>
                    How your retainer works
                  </h3>
                  <ol className="mt-4 space-y-4">
                    <li className="flex gap-3">
                      <span className="p-step-num">1</span>
                      <span className="min-w-0">
                        <span className="block" style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>
                          File a request
                        </span>
                        <span className="block t-small mt-0.5" style={{ lineHeight: 1.6 }}>
                          No email threads, no ticket forms — describe what you need and say how
                          urgent it is.
                        </span>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="p-step-num">2</span>
                      <span className="min-w-0">
                        <span className="block" style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>
                          We answer on a promised clock
                        </span>
                        <span className="block t-small mt-0.5" style={{ lineHeight: 1.6 }}>
                          A first-reply deadline is set the moment you file, and you can watch
                          your request move up the queue.
                        </span>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="p-step-num">3</span>
                      <span className="min-w-0">
                        <span className="block" style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>
                          Work draws from your hours
                        </span>
                        <span className="block t-small mt-0.5" style={{ lineHeight: 1.6 }}>
                          Everything delivered is logged against the hours on your plan, so the
                          balance above stays honest.
                        </span>
                      </span>
                    </li>
                  </ol>
                  <Link href="/portal/requests/new" className="p-btn p-btn-primary mt-6">
                    File your first request
                  </Link>
                </div>
              ) : (
                <>
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
                    emptyTitle="Nothing waiting on us"
                    emptyBody="Everything open has had a first reply from us."
                  />
                  {requests.length > queue.length && (
                    <p className="t-small mt-3">
                      <Link href="/portal/requests" className="hover:underline">
                        See all {requests.length} requests →
                      </Link>
                    </p>
                  )}
                </>
              )}
            </section>

            <aside className="space-y-5 min-w-0">
              {recent.length > 0 && (
                <div className="p-panel overflow-hidden">
                  <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
                    <h2 style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>Latest activity</h2>
                    <Link href="/portal/requests" className="t-fine hover:underline shrink-0">
                      See all
                    </Link>
                  </div>
                  <ul className="p-rows">
                    {recent.map((r) => {
                      const who =
                        r.submittedById === session.personId
                          ? "you"
                          : (requesterName(r) ?? "Airvues");
                      const state = requestState(r);
                      return (
                        <li key={r.id}>
                          <Link href={`/portal/requests/${r.id}`} className="p-row">
                            <span className="p-avatar" aria-hidden="true">
                              {who === "you"
                                ? initialsOf(session.name)
                                : initialsOf(requesterName(r))}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className="block truncate"
                                style={{ fontSize: "var(--t-sm)", fontWeight: 550 }}
                              >
                                {r.title}
                              </span>
                              <span className="block t-fine fig mt-0.5">
                                by {who} · {shortDate(r.submittedAt)} ·{" "}
                                <span style={{ color: toneInk(state.tone) }}>{state.label}</span>
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {primary?.tier && (
                <div className="p-sunk p-4">
                  <div style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>
                    {primary.tier.name} plan
                  </div>
                  <p className="t-small mt-1" style={{ lineHeight: 1.6 }}>
                    {included !== null
                      ? `${fmtHours(included)} hours of work included each billing period.`
                      : "Your team's standing line to Airvues."}
                  </p>
                  {isOwner && (
                    <p className="t-small mt-2">
                      <Link href="/portal/plan" className="hover:underline">
                        Plan details →
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </>
  );
}
