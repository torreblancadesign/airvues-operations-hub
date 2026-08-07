// Retainer health board — cross-retainer view answering "which retainer is at risk?".
// Read-only. Requests are created from the client portal (Plan 4) or ops triage (Plan 2b).
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { RetainerBoard } from "@/components/retainers/RetainerBoard";
import { assertCanAccess } from "@/lib/page-guard";
import { listRetainerAgreements, listRetainerTiers } from "@/lib/retainers";
import { hoursByRetainerInPeriod, listRetainerRequests } from "@/lib/retainer-requests";
import { buildBoardRows } from "@/lib/retainer-board";
import type { RetainerBoardRow } from "@/lib/retainer-types";

export const revalidate = 300;

export default async function RetainersRoute() {
  await assertCanAccess("/retainers");

  const now = new Date();
  let rows: RetainerBoardRow[] = [];
  let error: string | null = null;

  try {
    const [agreements, tiers, requests] = await Promise.all([
      listRetainerAgreements(),
      listRetainerTiers(),
      listRetainerRequests(),
    ]);
    const hoursByRetainer = await hoursByRetainerInPeriod(
      agreements.map((a) => a.id),
      now,
    );
    rows = buildBoardRows({ agreements, tiers, requests, hoursByRetainer, now });
  } catch (e) {
    error = (e as Error).message;
  }

  const totalOpen = rows.reduce((n, r) => n + r.openCount, 0);
  const totalBreached = rows.reduce((n, r) => n + r.breachedNowCount, 0);
  const totalAtRisk = rows.reduce((n, r) => n + r.atRiskCount, 0);
  const noTier = rows.filter((r) => r.tierName === null).length;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Retainers"
        subtitle="Which retainer is at risk. SLA clocks run 9am–6pm Mon–Fri Pacific."
        meta={
          <>
            <div className="font-mono tabnum">
              {rows.length} active retainer{rows.length === 1 ? "" : "s"}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard label="Open requests" value={String(totalOpen)} />
            <StatCard
              label="Breached"
              value={String(totalBreached)}
              tone={totalBreached > 0 ? "red" : "neutral"}
              sub="past deadline, unanswered"
            />
            <StatCard
              label="At risk"
              value={String(totalAtRisk)}
              tone={totalAtRisk > 0 ? "amber" : "neutral"}
              sub="75% of window elapsed"
            />
            <StatCard
              label="No tier linked"
              value={String(noTier)}
              tone={noTier > 0 ? "amber" : "neutral"}
              sub="SLA not measured"
            />
          </div>
          <RetainerBoard rows={rows} />
        </>
      )}
    </main>
  );
}
