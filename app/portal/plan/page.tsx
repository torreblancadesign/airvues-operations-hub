// The commercial terms of the agreement. OWNER ONLY — members are redirected,
// not merely hidden from the nav, because nav hiding is not a gate.
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalData } from "@/lib/portal-data";
import { RETAINER_PRIORITIES } from "@/lib/retainer-types";
import { Meter, fmtHours, shortDate } from "@/components/portal/bits";

export const dynamic = "force-dynamic";

export default async function PortalPlan() {
  const session = await getPortalSession();
  if (!session) redirect("/portal");
  if (session.role !== "Owner") redirect("/portal");

  const { retainers } = await getPortalData(session);
  const primary = retainers[0] ?? null;
  if (!primary) redirect("/portal");

  const { agreement, tier } = primary;
  const rate = agreement.monthlyRate ?? tier?.monthlyRate ?? null;
  const included = primary.includedHours;
  const used = primary.hoursLogged ?? 0;

  return (
    <>
      <h1 className="t-h1">Plan</h1>
      <p className="t-small mt-1">
        The terms of your agreement. Visible to account owners only.
      </p>

      <section className="p-hero mt-6 p-6 sm:p-7">
        <div className="t-label">Your plan</div>
        <div className="t-h1 mt-1">{tier?.name ?? agreement.projectName}</div>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <div className="t-fine">Monthly</div>
            <div className="t-num fig mt-0.5">
              {rate === null ? "—" : `$${rate.toLocaleString()}`}
            </div>
          </div>
          <div>
            <div className="t-fine">Hours included</div>
            <div className="t-num fig mt-0.5">{included === null ? "—" : fmtHours(included)}</div>
          </div>
          <div>
            <div className="t-fine">Started</div>
            <div className="t-num fig mt-0.5">{shortDate(agreement.effectiveDate)}</div>
          </div>
        </div>

        {included !== null && (
          <div className="mt-6 max-w-[420px]">
            <div className="flex items-baseline justify-between">
              <span className="t-fine">This period</span>
              <span className="t-fine fig">
                {fmtHours(used)} of {fmtHours(included)}
              </span>
            </div>
            <div className="mt-1.5">
              <Meter value={used} max={included} />
            </div>
          </div>
        )}
      </section>

      <section className="p-panel mt-4 p-6">
        <h2 className="t-h2">Response times</h2>
        <p className="t-small mt-1">
          How quickly we reply to a first message, counted in business hours — 9am–6pm Pacific,
          Monday to Friday.
        </p>
        {tier ? (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
            {RETAINER_PRIORITIES.map((p) => (
              <div key={p}>
                <div className="t-fine">{p}</div>
                <div className="t-num fig mt-0.5">
                  {tier.slaHours[p] === null ? (
                    <span className="t-small">not covered</span>
                  ) : (
                    <>
                      {tier.slaHours[p]}
                      <span className="t-fine" style={{ fontWeight: 500 }}>
                        {" "}
                        hrs
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="t-body mt-4">
            No response times are set on this plan yet, so requests are recorded but not timed.
            Your account lead can confirm what you are owed.
          </p>
        )}
      </section>
    </>
  );
}
