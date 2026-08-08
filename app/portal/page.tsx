// The client-facing portal, first surface.
//
// EVERY read here is filtered on the session's Company id. That is the tenant
// boundary and there are no exceptions — a client must never see another
// client's retainer, requests, or hours.
import Link from "next/link";
import { getPortalSession } from "@/lib/portal-session";
import { portalSecretConfigured } from "@/lib/portal-token";
import { listRetainerAgreements, listRetainerTiers } from "@/lib/retainers";
import { listRetainerRequests } from "@/lib/retainer-requests";
import { currentPeriod } from "@/lib/retainer-period";
import { OPEN_REQUEST_STATUSES, RETAINER_PRIORITIES } from "@/lib/retainer-types";

export const dynamic = "force-dynamic";

const DENIALS: Record<string, string> = {
  missing: "That link was incomplete. Ask your Airvues contact for a new one.",
  expired: "That sign-in link has expired. They only last 30 minutes — ask for a fresh one.",
  revoked: "Your access has been turned off. Please contact your Airvues account lead.",
  unknown: "We could not find your record. Please contact your Airvues account lead.",
  noclient: "Your account is not linked to a client yet. Please contact your account lead.",
  unconfigured: "Portal sign-in is not configured on this deployment.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-5 py-10">{children}</div>
    </main>
  );
}

export default async function PortalHome({
  searchParams,
}: {
  searchParams?: { denied?: string };
}) {
  const session = await getPortalSession();

  if (!session) {
    const denied = searchParams?.denied;
    return (
      <Shell>
        <h1 className="text-[20px] font-semibold text-ink-strong">Airvues client portal</h1>
        <p className="text-[13px] text-ink-muted mt-3 leading-relaxed max-w-lg">
          {denied
            ? (DENIALS[denied] ?? DENIALS.expired)
            : "Sign in with the one-time link your Airvues account lead sent you. There is no password."}
        </p>
        {!portalSecretConfigured() && (
          <p className="text-[12px] text-amber mt-4">
            No signing secret is configured, so links cannot be issued or accepted. Set
            PORTAL_SESSION_SECRET (or AUTH_SECRET).
          </p>
        )}
      </Shell>
    );
  }

  const [agreements, tiers, allRequests] = await Promise.all([
    listRetainerAgreements(),
    listRetainerTiers(),
    listRetainerRequests(),
  ]);

  // --- the tenant boundary ---
  const mine = agreements.filter((a) => a.companyId === session.companyId);
  const myIds = new Set(mine.map((a) => a.id));
  const requests = allRequests
    .filter((r) => r.companyId === session.companyId && r.retainerId && myIds.has(r.retainerId))
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

  const open = requests.filter((r) => r.status && OPEN_REQUEST_STATUSES.includes(r.status));
  const now = new Date();

  return (
    <Shell>
      <header className="pb-5 border-b border-rule">
        <h1 className="text-[20px] font-semibold text-ink-strong">Your retainer</h1>
        <p className="text-[13px] text-ink-muted mt-1">
          Signed in as {session.name} · {session.email}
          {session.role === "Owner" && " · account owner"}
        </p>
      </header>

      {mine.length === 0 ? (
        <p className="text-[13px] text-ink-muted mt-6">
          There is no active retainer on your account yet. Your Airvues account lead can set one
          up.
        </p>
      ) : (
        mine.map((a) => {
          const tier = a.tierId ? (tiers.find((t) => t.id === a.tierId) ?? null) : null;
          const period = currentPeriod(a.effectiveDate, now);
          return (
            <section key={a.id} className="mt-6 bg-surface border border-rule rounded-card p-5">
              <h2 className="text-[15px] font-semibold text-ink-strong">
                {tier?.name ?? a.projectName}
              </h2>
              <div className="mt-2 flex items-baseline gap-3 flex-wrap text-[13px]">
                {(a.monthlyRate ?? tier?.monthlyRate) != null && (
                  <>
                    <span className="tabnum text-ink-strong">
                      ${(a.monthlyRate ?? tier?.monthlyRate)!.toLocaleString()}
                    </span>
                    <span className="text-ink-faint">/ month</span>
                  </>
                )}
                {(a.includedHours ?? tier?.includedHours) != null && (
                  <>
                    <span className="text-rule-strong">·</span>
                    <span className="tabnum text-ink-strong">
                      {a.includedHours ?? tier?.includedHours}h
                    </span>
                    <span className="text-ink-faint">included each month</span>
                  </>
                )}
              </div>

              {tier && (
                <div className="mt-4 pt-4 border-t border-rule/60">
                  <div className="eyebrow mb-2">
                    We respond within · business hours, 9–6 Mon–Fri Pacific
                  </div>
                  <div className="flex flex-wrap gap-x-8 gap-y-2">
                    {RETAINER_PRIORITIES.map((p) => (
                      <div key={p}>
                        <div className="text-[10px] text-ink-faint uppercase tracking-wider">
                          {p}
                        </div>
                        <div className="text-[16px] text-ink-strong font-semibold tabnum">
                          {tier.slaHours[p] === null ? (
                            <span className="text-[13px] text-ink-muted font-normal">
                              not covered
                            </span>
                          ) : (
                            <>
                              {tier.slaHours[p]}
                              <span className="text-[12px] text-ink-faint font-normal">h</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {period && (
                <p className="text-[11px] text-ink-faint mt-4 tabnum">
                  Current period {period.start.toISOString().slice(0, 10)} →{" "}
                  {period.end.toISOString().slice(0, 10)}
                </p>
              )}
            </section>
          );
        })
      )}

      <section className="mt-6">
        <h2 className="text-[15px] font-semibold text-ink-strong mb-3">
          Your requests
          <span className="ml-2 text-[12px] text-ink-faint font-normal tabnum">
            {open.length} open · {requests.length} total
          </span>
        </h2>
        {requests.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Nothing filed yet. Email your account lead and we will log it here.
          </p>
        ) : (
          <ul className="bg-surface border border-rule rounded-card divide-y divide-rule/60">
            {requests.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="text-[13px] text-ink-strong">{r.title}</div>
                <div className="text-[11px] text-ink-muted mt-0.5 tabnum">
                  {r.priority ?? "Medium"} · {r.status ?? "Submitted"}
                  {r.submittedAt && ` · filed ${r.submittedAt.slice(0, 10)}`}
                  {r.firstRespondedAt
                    ? ` · answered ${r.firstRespondedAt.slice(0, 10)}`
                    : " · awaiting our reply"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-10 pt-5 border-t border-rule text-[11px] text-ink-faint">
        Airvues LLC ·{" "}
        <Link href="/portal/signout" className="underline hover:text-ink-muted">
          Sign out
        </Link>
      </footer>
    </Shell>
  );
}
