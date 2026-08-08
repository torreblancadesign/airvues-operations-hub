import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalData } from "@/lib/portal-data";
import { NewRequestForm } from "@/components/portal/NewRequestForm";
import { RETAINER_PRIORITIES, type RetainerPriority } from "@/lib/retainer-types";

export const dynamic = "force-dynamic";

export default async function NewPortalRequest() {
  const session = await getPortalSession();
  if (!session) redirect("/portal");

  const { retainers } = await getPortalData(session);
  if (retainers.length === 0) redirect("/portal");

  // The promise shown against each priority comes from the plan the request
  // will actually be filed against, so the form never quotes a time the
  // client is not owed.
  //
  // Owners only. Response windows are a commercial term of the agreement, and
  // members are not shown them anywhere on this surface — including here,
  // where it would otherwise leak through the priority picker.
  const isOwner = session.role === "Owner";
  const tier = retainers[0].tier;
  const promised = Object.fromEntries(
    RETAINER_PRIORITIES.map((p) => [p, isOwner ? (tier?.slaHours[p] ?? null) : null]),
  ) as Record<RetainerPriority, number | null>;

  return (
    <div className="max-w-[680px]">
      <Link
        href="/portal"
        className="t-small hover:underline"
      >
        ← Back
      </Link>
      <h1
        className="t-h1 mt-3"
      >
        New request
      </h1>
      <p className="t-body mt-1.5">
        The response clock starts the moment you send this.
      </p>

      <NewRequestForm
        retainers={retainers.map((r) => ({
          id: r.agreement.id,
          label: r.tier?.name ?? r.agreement.projectName,
        }))}
        promised={promised}
        showPromises={isOwner}
      />
    </div>
  );
}
