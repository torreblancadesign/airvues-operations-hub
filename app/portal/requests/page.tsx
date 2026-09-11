// Every request the client's team has filed, open and closed.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalData } from "@/lib/portal-data";
import { OPEN_REQUEST_STATUSES } from "@/lib/retainer-types";
import { Pill, requestState, shortDate } from "@/components/portal/bits";

export const dynamic = "force-dynamic";

export default async function PortalRequests() {
  const session = await getPortalSession();
  if (!session) redirect("/portal");

  const { requests, requesterName, retainers } = await getPortalData(session);
  const open = requests.filter((r) => r.status && OPEN_REQUEST_STATUSES.includes(r.status));
  const done = requests.filter((r) => !open.includes(r));

  function List({ rows }: { rows: typeof requests }) {
    return (
      <ul className="p-panel overflow-hidden">
        {rows.map((r) => {
          const state = requestState(r);
          const mine = r.submittedById === session!.personId;
          return (
            <li key={r.id}>
              <Link href={`/portal/requests/${r.id}`} className="p-row">
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate"
                    style={{ fontSize: "var(--t-md)", fontWeight: 550, letterSpacing: "-0.01em" }}
                  >
                    {r.title}
                  </span>
                  <span className="block t-fine fig mt-0.5">
                    {r.priority ?? "Medium"} ·{" "}
                    {mine ? "you" : (requesterName(r) ?? "your team")} asked{" "}
                    {shortDate(r.submittedAt)}
                    {r.firstRespondedAt && ` · we replied ${shortDate(r.firstRespondedAt)}`}
                  </span>
                </span>
                <span className="shrink-0" style={{ paddingTop: 2 }}>
                  <Pill tone={state.tone}>{state.label}</Pill>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="t-h1">Requests</h1>
          <p className="t-small mt-1 fig">
            {requests.length} total · {open.length} open
          </p>
        </div>
        {retainers.length > 0 && (
          <Link href="/portal/requests/new" className="p-btn p-btn-primary shrink-0">
            New request
          </Link>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="p-panel px-6 py-10 text-center mt-6">
          <p style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>Nothing filed yet</p>
          <p className="t-body mt-2 mx-auto" style={{ maxWidth: 380, lineHeight: 1.6 }}>
            When your team needs something, file it here instead of email.
          </p>
          {retainers.length > 0 && (
            <Link href="/portal/requests/new" className="p-btn p-btn-primary mt-5">
              File your first request
            </Link>
          )}
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section className="mt-7">
              <h2 className="t-h2 mb-3">Open</h2>
              <List rows={open} />
            </section>
          )}
          {done.length > 0 && (
            <section className="mt-8">
              <h2 className="t-h2 mb-3">History</h2>
              <List rows={done} />
            </section>
          )}
        </>
      )}
    </>
  );
}
