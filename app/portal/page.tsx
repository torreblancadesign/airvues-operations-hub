// Portal dashboard: what you bought, what is left, what we owe you, and where
// your team's requests sit in the queue.
//
// Every read goes through lib/portal-data.ts, which owns the tenant boundary.
//
// ROLE GATE: commercial terms — the monthly rate and the agreed response
// windows — are Owner-only. Members see the work and its status, never what
// the account costs. Confirmed by the user 2026-08-08.
import Link from "next/link";
import { getPortalSession } from "@/lib/portal-session";
import { portalSecretConfigured } from "@/lib/portal-token";
import { getPortalData } from "@/lib/portal-data";
import { OPEN_REQUEST_STATUSES, RETAINER_PRIORITIES } from "@/lib/retainer-types";
import { Label, Meter, Pill, fmtHours, requestState, shortDate } from "@/components/portal/bits";

export const dynamic = "force-dynamic";

const DENIALS: Record<string, string> = {
  missing: "That link was incomplete. Ask your Airvues contact for a new one.",
  expired: "That sign-in link has expired — they last 30 minutes. Ask for a fresh one.",
  revoked: "Your access has been turned off. Please contact your Airvues account lead.",
  unknown: "We could not find your record. Please contact your Airvues account lead.",
  noclient: "Your account is not linked to a client yet. Please contact your account lead.",
  unconfigured: "Portal sign-in is not configured on this deployment.",
};

function Page({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[1040px] px-5 py-8 sm:py-10">{children}</main>;
}

function Stat({
  label,
  value,
  unit,
  tone,
  foot,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
  foot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-card p-5 flex flex-col">
      <Label>{label}</Label>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="display-num" style={{ fontSize: 34, color: tone ?? "var(--p-ink)" }}>
          {value}
        </span>
        {unit && (
          <span className="fig" style={{ fontSize: 13.5, color: "var(--p-ink-3)" }}>
            {unit}
          </span>
        )}
      </div>
      {children}
      {foot && (
        <div style={{ fontSize: 12, color: "var(--p-ink-3)", marginTop: "auto", paddingTop: 10 }}>
          {foot}
        </div>
      )}
    </div>
  );
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
      <Page>
        <div className="p-card max-w-[520px] mx-auto p-8 text-center">
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Your Airvues retainer
          </h1>
          <p style={{ fontSize: 15, color: "var(--p-ink-2)", marginTop: 10, lineHeight: 1.6 }}>
            {denied
              ? (DENIALS[denied] ?? DENIALS.expired)
              : "Open the one-time link your Airvues account lead sent you. There is no password to remember."}
          </p>
          {!portalSecretConfigured() && (
            <p style={{ fontSize: 13, color: "var(--p-warn)", marginTop: 16 }}>
              No signing secret is configured on this deployment, so links cannot be issued or
              accepted.
            </p>
          )}
        </div>
      </Page>
    );
  }

  const isOwner = session.role === "Owner";
  const now = new Date();
  const { retainers, requests, queue, record, requesterName, promisedHoursFor } =
    await getPortalData(session, now);

  const open = requests.filter((r) => r.status && OPEN_REQUEST_STATUSES.includes(r.status));
  const history = requests.filter((r) => !open.includes(r));
  const primary = retainers[0] ?? null;

  const hoursLogged = primary?.hoursLogged ?? 0;
  const included = primary?.includedHours ?? null;
  const remaining = included === null ? null : Math.max(0, included - hoursLogged);
  const daysLeft = primary?.periodEnd
    ? Math.max(0, Math.ceil((new Date(primary.periodEnd).getTime() - now.getTime()) / 86_400_000))
    : null;
  const breachedWaiting = queue.some((q) => q.request.slaOutcome === "Breached");

  return (
    <Page>
      {searchParams?.filed && (
        <div
          className="p-card mb-6 px-4 py-3.5"
          style={{ borderColor: "var(--p-ok)", background: "var(--p-ok-bg)" }}
        >
          <span style={{ color: "var(--p-ok)", fontWeight: 600, fontSize: 14.5 }}>
            Request received.
          </span>{" "}
          <span style={{ fontSize: 14.5, color: "var(--p-ink-2)" }}>
            It has joined the queue below.
          </span>
        </div>
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            {session.name.split(" ")[0]}, here is where things stand
          </h1>
          {primary?.periodStart && primary?.periodEnd && (
            <p className="fig" style={{ fontSize: 13.5, color: "var(--p-ink-3)", marginTop: 4 }}>
              {shortDate(primary.periodStart)} – {shortDate(primary.periodEnd)}
              {daysLeft !== null && ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            </p>
          )}
        </div>
        {retainers.length > 0 && (
          <Link href="/portal/requests/new" className="p-btn p-btn-primary">
            New request
          </Link>
        )}
      </div>

      {retainers.length === 0 ? (
        <div className="p-card p-8">
          <p style={{ fontSize: 15, color: "var(--p-ink-2)" }}>
            There is no active retainer on your account yet. Your Airvues account lead can set
            one up.
          </p>
        </div>
      ) : (
        <>
          {/* --- the dashboard row --- */}
          <section className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Hours left"
              value={included === null ? "—" : fmtHours(remaining)}
              unit={included === null ? undefined : `of ${fmtHours(included)}`}
              tone={remaining === 0 ? "var(--p-warn)" : undefined}
              foot={
                included === null
                  ? "No hour allowance on this plan."
                  : `${fmtHours(hoursLogged)} used · recent work may not be logged yet`
              }
            >
              {included !== null && (
                <div className="mt-3">
                  <Meter value={hoursLogged} max={included} />
                </div>
              )}
            </Stat>

            <Stat
              label="Waiting on us"
              value={String(queue.length)}
              unit={open.length > 0 ? `of ${open.length} open` : undefined}
              tone={breachedWaiting ? "var(--p-bad)" : undefined}
              foot={
                queue.length === 0
                  ? "Everything open has had a first reply."
                  : breachedWaiting
                    ? "One or more is past the time we promised."
                    : "All inside the time we promised."
              }
            />

            <Stat
              label="Typical first reply"
              value={record.averageHours === null ? "—" : fmtHours(record.averageHours)}
              unit={record.averageHours === null ? undefined : "business hrs"}
              foot={
                record.answered === 0
                  ? "No requests answered yet."
                  : `across ${record.answered} answered request${record.answered === 1 ? "" : "s"}`
              }
            />

            <Stat
              label="Answered on time"
              value={
                record.metCount + record.breachedCount === 0
                  ? "—"
                  : `${Math.round((record.metCount / (record.metCount + record.breachedCount)) * 100)}%`
              }
              tone={record.breachedCount > 0 ? "var(--p-warn)" : undefined}
              foot={
                record.metCount + record.breachedCount === 0
                  ? "Nothing measured yet."
                  : `${record.metCount} on time · ${record.breachedCount} late`
              }
            />
          </section>

          {/* --- plan: OWNER ONLY --- */}
          {isOwner && (
            <section className="p-card mt-3.5 p-5">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <Label>Your plan</Label>
                  <div
                    style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", marginTop: 2 }}
                  >
                    {primary?.tier?.name ?? primary?.agreement.projectName ?? "—"}
                  </div>
                </div>
                {(primary?.agreement.monthlyRate ?? primary?.tier?.monthlyRate) != null && (
                  <div className="fig" style={{ fontSize: 15, color: "var(--p-ink-2)" }}>
                    $
                    {(primary?.agreement.monthlyRate ?? primary?.tier?.monthlyRate)!.toLocaleString()}
                    <span style={{ color: "var(--p-ink-3)" }}> / month</span>
                  </div>
                )}
              </div>

              {primary?.tier ? (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--p-line)" }}>
                  <Label>We reply within</Label>
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {RETAINER_PRIORITIES.map((p) => (
                      <div key={p}>
                        <div style={{ fontSize: 12.5, color: "var(--p-ink-3)" }}>{p}</div>
                        <div className="fig" style={{ fontSize: 19, fontWeight: 600, marginTop: 1 }}>
                          {primary.tier!.slaHours[p] === null ? (
                            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--p-ink-3)" }}>
                              not covered
                            </span>
                          ) : (
                            <>
                              {primary.tier!.slaHours[p]}
                              <span
                                style={{ fontSize: 13, color: "var(--p-ink-3)", fontWeight: 500 }}
                              >
                                {" "}
                                hrs
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: "var(--p-ink-2)", marginTop: 12 }}>
                  No response times are set on this plan yet, so requests are recorded but not
                  timed.
                </p>
              )}
              <p style={{ fontSize: 11.5, color: "var(--p-ink-3)", marginTop: 14 }}>
                Visible to account owners only.
              </p>
            </section>
          )}
        </>
      )}

      {/* --- the queue --- */}
      <section className="mt-8">
        <h2 style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.015em" }}>
          In the queue
          {queue.length > 0 && (
            <span className="fig" style={{ color: "var(--p-ink-3)", fontWeight: 500 }}>
              {" "}
              · {queue.length}
            </span>
          )}
        </h2>
        <p style={{ fontSize: 13, color: "var(--p-ink-3)", marginTop: 3, marginBottom: 12 }}>
          Everything your team is waiting on us for, in the order the promised times fall.
        </p>

        {queue.length === 0 ? (
          <div className="p-card p-7 text-center">
            <p style={{ fontSize: 14.5, fontWeight: 550 }}>Nothing waiting on us</p>
            <p style={{ fontSize: 13.5, color: "var(--p-ink-2)", marginTop: 5 }}>
              {requests.length === 0
                ? "When you need something, file it here instead of email."
                : "Everything open has had a first reply."}
            </p>
            {retainers.length > 0 && requests.length === 0 && (
              <Link href="/portal/requests/new" className="p-btn p-btn-primary mt-4">
                File your first request
              </Link>
            )}
          </div>
        ) : (
          <ul className="p-card overflow-hidden">
            {queue.map((q, i) => {
              const r = q.request;
              const who = requesterName(r);
              const mine = r.submittedById === session.personId;
              const promised = promisedHoursFor(r);
              const late = r.slaOutcome === "Breached";
              return (
                <li key={r.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--p-line)" }}>
                  <Link
                    href={`/portal/requests/${r.id}`}
                    className="flex items-start gap-3.5 px-5 py-4 hover:bg-[var(--p-card-sunk)] transition-colors"
                  >
                    <span
                      className="fig shrink-0"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--p-ink-3)",
                        width: 20,
                        paddingTop: 2,
                      }}
                      aria-label={`Position ${q.position} in the queue`}
                    >
                      {q.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: 15, fontWeight: 550, letterSpacing: "-0.01em" }}>
                        {r.title}
                      </div>
                      <div
                        className="fig"
                        style={{ fontSize: 12.5, color: "var(--p-ink-3)", marginTop: 3 }}
                      >
                        {r.priority ?? "Medium"}
                        {" · "}
                        {mine ? "you" : (who ?? "your team")} asked {shortDate(r.submittedAt)}
                        {q.waitedHours !== null && ` · waiting ${fmtHours(q.waitedHours)} business hrs`}
                        {promised !== null && ` of ${promised}`}
                      </div>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <Pill tone={late ? "bad" : "info"}>
                        {late ? "Past promised time" : "Awaiting reply"}
                      </Pill>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --- history --- */}
      {(history.length > 0 || open.length > queue.length) && (
        <section className="mt-8">
          <h2 style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.015em" }}>History</h2>
          <p style={{ fontSize: 13, color: "var(--p-ink-3)", marginTop: 3, marginBottom: 12 }}>
            Everything your team has asked for, and what happened.
          </p>
          <ul className="p-card overflow-hidden">
            {requests
              .filter((r) => !queue.some((q) => q.request.id === r.id))
              .map((r, i) => {
                const state = requestState(r);
                const who = requesterName(r);
                const mine = r.submittedById === session.personId;
                return (
                  <li key={r.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--p-line)" }}>
                    <Link
                      href={`/portal/requests/${r.id}`}
                      className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-[var(--p-card-sunk)] transition-colors"
                    >
                      <div className="min-w-0">
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>{r.title}</div>
                        <div
                          className="fig"
                          style={{ fontSize: 12.5, color: "var(--p-ink-3)", marginTop: 2 }}
                        >
                          {mine ? "you" : (who ?? "your team")} asked {shortDate(r.submittedAt)}
                          {r.firstRespondedAt && ` · replied ${shortDate(r.firstRespondedAt)}`}
                        </div>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <Pill tone={state.tone}>{state.label}</Pill>
                      </div>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </Page>
  );
}
