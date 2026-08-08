// Per-retainer deep dive: agreement terms, request queue, thread, triage to Story.
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { RetainerDetail } from "@/components/retainers/RetainerDetail";
import { RetainerTerms } from "@/components/retainers/RetainerTerms";
import { RetainerContacts } from "@/components/retainers/RetainerContacts";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";
import {
  legacySelectedTierFor,
  listRetainerAgreements,
  listRetainerTiers,
} from "@/lib/retainers";
import { listContactsForCompany } from "@/lib/retainer-contacts";
import { currentPeriod } from "@/lib/retainer-period";
import { listRetainerComments, listRetainerRequests } from "@/lib/retainer-requests";
import { listPeopleOptions } from "@/lib/quotes";
import type { RetainerComment } from "@/lib/retainer-types";

export const revalidate = 0;

export default async function RetainerDetailRoute({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { r?: string };
}) {
  await assertCanAccess("/retainers");

  const [agreements, tiers, allRequests, people, canEdit, legacySelectedTier] =
    await Promise.all([
      listRetainerAgreements(),
      listRetainerTiers(),
      listRetainerRequests(),
      listPeopleOptions(),
      canMutate(),
      legacySelectedTierFor(params.id),
    ]);

  const agreement = agreements.find((a) => a.id === params.id);
  if (!agreement) notFound();

  const tier = agreement.tierId ? (tiers.find((t) => t.id === agreement.tierId) ?? null) : null;
  const requests = allRequests
    .filter((r) => r.retainerId === agreement.id)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

  const selectedId = typeof searchParams?.r === "string" ? searchParams.r : null;
  const selected = selectedId ? (requests.find((r) => r.id === selectedId) ?? null) : null;

  let comments: RetainerComment[] = [];
  if (selected) comments = await listRetainerComments(selected.id);

  const period = currentPeriod(agreement.effectiveDate, new Date());
  // Loaded after the agreement so the company link is known.
  const contacts = await listContactsForCompany(agreement.companyId);

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title={agreement.companyName ?? agreement.projectName}
        subtitle={
          <>
            {agreement.projectName}
            {agreement.contactName && ` · ${agreement.contactName}`}
          </>
        }
        meta={
          <>
            <Link href="/retainers" className="hover:text-ink-strong underline">
              ← All retainers
            </Link>
            <div className="text-[11px] text-ink-faint mt-0.5">
              <Link href={`/pipeline/${agreement.id}`} className="hover:text-ink-strong underline">
                Open project
              </Link>
            </div>
          </>
        }
      />
      <div className="space-y-5">
        <RetainerTerms
          agreement={agreement}
          tier={tier}
          tiers={tiers}
          periodStart={period ? period.start.toISOString() : null}
          periodEnd={period ? period.end.toISOString() : null}
          canEdit={canEdit}
          legacySelectedTier={legacySelectedTier}
        />
        <RetainerDetail
          agreement={agreement}
          requests={requests}
          selected={selected}
          comments={comments}
          people={people}
        />
        <RetainerContacts
          contacts={contacts}
          companyId={agreement.companyId}
          companyName={agreement.companyName}
          canEdit={canEdit}
        />
      </div>
    </main>
  );
}
