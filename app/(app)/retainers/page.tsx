// Retainer health board — cross-retainer view answering "which retainer is at risk?".
// Create and edit live here too; requests are filed from the detail page.
import { PageHeader } from "@/components/ui/PageHeader";
import { RetainerHeadline } from "@/components/retainers/RetainerHeadline";
import { RetainerBoard } from "@/components/retainers/RetainerBoard";
import { NewRetainerButton } from "@/components/retainers/NewRetainerButton";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";
import { listRetainerAgreements, listRetainerTiers } from "@/lib/retainers";
import { listCompanyOptions, type CompanyOption } from "@/lib/retainer-companies";
import { hoursByRetainerInPeriod, listRetainerRequests } from "@/lib/retainer-requests";
import { buildBoardRows } from "@/lib/retainer-board";
import type { RetainerBoardRow, RetainerTier } from "@/lib/retainer-types";

export const revalidate = 300;

export default async function RetainersRoute() {
  await assertCanAccess("/retainers");

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

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Retainers"
        subtitle="Response clocks run 9am–6pm, Monday to Friday, Pacific."
        meta={
          <>
            <div className="font-mono tabnum">
              {liveRows.length} active retainer{liveRows.length === 1 ? "" : "s"}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">5-min cache</div>
          </>
        }
      />

      {error ? (
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load retainers: {error}
        </div>
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
