// Engineering Board — Tier 1 of one.airvues.
// Stories grouped by Assignee, with commission = 15% of Story.Invoice.
// Surfaces orphan stories (no engineer) at the top.
import { PageHeader } from "@/components/ui/PageHeader";
import { EngineeringBoard } from "@/components/engineering/EngineeringBoard";
import { getEngineeringBoard } from "@/lib/engineering";
import { canMutate } from "@/lib/authz";

export const revalidate = 300;

export default async function EngineeringPage() {
  let data;
  const editable = await canMutate();
  try {
    data = await getEngineeringBoard();
  } catch (err) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader
          title="Engineering Board"
          subtitle="Stories grouped by engineer. Each story carries a 15% commission of its scoped value."
        />
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load engineering data: {(err as Error).message}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Engineering Board"
        subtitle="Stories grouped by engineer. Each story carries a 15% commission of its scoped value."
        meta={
          <>
            <div className="font-mono tabnum">
              {data.groups.filter((g) => !g.isOrphan).length} engineers ·{" "}
              {data.totals.activeStories} active
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">5-min cache · 15% flat commission</div>
          </>
        }
      />
      <EngineeringBoard data={data} canEdit={editable} />
    </main>
  );
}
