// /sprints — index of all sprints. Velocity overview at top, then In Progress / Next / Done.
// Click a row to open the kanban board for that sprint.
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SprintRow } from "@/components/sprints/SprintRow";
import { VelocityOverview } from "@/components/sprints/VelocityOverview";
import { SprintsClient } from "@/components/sprints/SprintsClient";
import { listSprints } from "@/lib/sprints";
import { computeVelocity } from "@/lib/velocity";
import { canMutate } from "@/lib/authz";
import { assertCanAccess } from "@/lib/page-guard";

export const revalidate = 60;

export default async function SprintsPage() {
  await assertCanAccess("/sprints");
  let sprints;
  const editable = await canMutate();
  try {
    sprints = await listSprints();
  } catch (err) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader title="Sprints" />
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load sprints: {(err as Error).message}
        </div>
      </main>
    );
  }

  const active = sprints.filter((s) => s.status === "In Progress");
  const next = sprints.filter((s) => s.status === "Next");
  const done = sprints.filter((s) => s.status === "Done");
  const other = sprints.filter((s) => !s.status || !["In Progress", "Next", "Done"].includes(s.status));
  const velocity = computeVelocity(sprints);
  const maxNumber = sprints.reduce((max, s) => Math.max(max, s.number ?? 0), 0);
  const suggestedNumber = maxNumber + 1;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Sprints"
        subtitle="Active sprint pinned at top. Click any sprint to open its kanban board."
        meta={
          <>
            <div className="font-mono tabnum">
              {sprints.length.toLocaleString()} total · {active.length} active
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">5-min cache</div>
          </>
        }
      />

      <SprintsClient suggestedNumber={suggestedNumber} canEdit={editable}>
        <VelocityOverview velocity={velocity} />

          {active.length > 0 && (
          <div className="mb-8">
            <SectionTitle title="Active" aside={`${active.length} in progress`} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {active.map((s) => <SprintRow key={s.id} sprint={s} />)}
            </div>
          </div>
        )}

        {next.length > 0 && (
          <div className="mb-8">
            <SectionTitle title="Upcoming" aside={`${next.length} planned`} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {next.map((s) => <SprintRow key={s.id} sprint={s} />)}
            </div>
          </div>
        )}

        {other.length > 0 && (
          <div className="mb-8">
            <SectionTitle title="Other" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {other.map((s) => <SprintRow key={s.id} sprint={s} />)}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <SectionTitle title="Completed" aside={`${done.length} done`} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {done.slice(0, 12).map((s) => <SprintRow key={s.id} sprint={s} />)}
            </div>
            {done.length > 12 && (
              <div className="mt-3 text-center text-[11px] font-mono text-ink-faint tabnum">
                {done.length - 12} older sprints hidden — open Airtable for full history
              </div>
            )}
          </div>
        )}
      </SprintsClient>
    </main>
  );
}