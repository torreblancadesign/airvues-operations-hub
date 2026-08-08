// Retainers — two views behind one route.
//   ?tab=board (default) — which retainer is at risk, plus create/edit.
//   ?tab=plans           — the plan catalog the response times are read from.
// Both views need the same tiers and companies, so one page loads once and
// switches, rather than paying for a second route that reads the same data.
import { PageHeader } from "@/components/ui/PageHeader";
import { RetainerHeadline } from "@/components/retainers/RetainerHeadline";
import { RetainerBoard } from "@/components/retainers/RetainerBoard";
import { NewRetainerButton } from "@/components/retainers/NewRetainerButton";
import { PlanCatalog } from "@/components/retainers/PlanCatalog";
import { RetainerTabs, parseTab } from "@/components/retainers/RetainerTabs";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";
import { listRetainerAgreements, listRetainerTiers } from "@/lib/retainers";
import { listCompanyOptions, type CompanyOption } from "@/lib/retainer-companies";
import { hoursByRetainerInPeriod, listRetainerRequests } from "@/lib/retainer-requests";
import { buildBoardRows } from "@/lib/retainer-board";
import type { RetainerBoardRow, RetainerTier } from "@/lib/retainer-types";

export const revalidate = 300;

export default async function RetainersRoute({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  await assertCanAccess("/retainers");

  const tab = parseTab(searchParams?.tab);
  const canEdit = await canMutate();
  const now = new Date();
  let rows: RetainerBoardRow[] = [];
  let tiers: RetainerTier[] = [];
  let companies: CompanyOption[] = [];
  let error: string | null = null;

  try {
    const [agreements, allTiers, requests, companyOptions] = await Promise.all([
      listRetainerAgreements(),
      listRetainerTiers(),
      listRetainerRequests(),
      listCompanyOptions(),
    ]);
    tiers = allTiers;
    companies = companyOptions;
    const hoursByRetainer = await hoursByRetainerInPeriod(
      agreements.map((a) => a.id),
      now,
    );
    rows = buildBoardRows({ agreements, tiers, requests, hoursByRetainer, now });
  } catch (e) {
    error = (e as Error).message;
  }

  // Counters describe LIVE, non-archived retainers only. A rejected quote or
  // an unsigned proposal carries the same Proposal Type but is not under any
  // SLA, and counting it made the board overstate exposure.
  const liveRows = rows.filter((r) => r.subscriptionActive && !r.archived);
  const totalUnanswered = liveRows.reduce((n, r) => n + r.unansweredCount, 0);
  const totalBreached = liveRows.reduce((n, r) => n + r.breachedNowCount, 0);
  const totalAtRisk = liveRows.reduce((n, r) => n + r.atRiskCount, 0);
  const noTier = liveRows.filter((r) => r.tierName === null).length;
  const overHours = liveRows.filter(
    (r) => r.includedHours !== null && (r.hoursLoggedThisPeriod ?? 0) > r.includedHours,
  ).length;

  const activePlans = tiers.filter((t) => t.active);
  const uncovered = activePlans.filter((t) =>
    Object.values(t.slaHours).every((h) => h === null),
  ).length;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Retainers"
        subtitle={
          tab === "plans"
            ? "Rates, included hours, and the response times every retainer is measured against."
            : "Response clocks run 9am–6pm, Monday to Friday, Pacific."
        }
        meta={
          <>
            <div className="font-mono tabnum">
              {liveRows.length} active retainer{liveRows.length === 1 ? "" : "s"}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">5-min cache</div>
          </>
        }
      />

      <RetainerTabs active={tab} planCount={activePlans.length} />

      {error ? (
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load retainers: {error}
        </div>
      ) : tab === "plans" ? (
        <>
          {uncovered > 0 && (
            <div className="bg-surface border border-amber/30 rounded-card px-4 py-2.5 text-[12px] text-amber mb-4">
              {uncovered} active plan{uncovered === 1 ? " has" : "s have"} no response times set.
              Requests on {uncovered === 1 ? "it" : "them"} are recorded but never measured.
            </div>
          )}
          <PlanCatalog tiers={tiers} companies={companies} canEdit={canEdit} />
        </>
      ) : (
        <>
          {canEdit && (
            <div className="mb-4">
              <NewRetainerButton companies={companies} tiers={tiers} />
            </div>
          )}
          <RetainerHeadline
            liveCount={liveRows.length}
            unanswered={totalUnanswered}
            breached={totalBreached}
            atRisk={totalAtRisk}
            noPlan={noTier}
            overHours={overHours}
          />
          <RetainerBoard rows={rows} />
        </>
      )}
    </main>
  );
}
