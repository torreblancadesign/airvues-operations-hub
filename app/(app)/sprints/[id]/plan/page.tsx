// /sprints/[id]/plan — capacity planning for a single sprint.
// Engineer rows with editable per-sprint capacity; story pool below.
// Capacity defaults to DEFAULT_CAPACITY_HOURS until an override is saved
// in the 🟢 Sprint Capacity table.
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SprintPlanBoard } from "@/components/sprints/SprintPlanBoard";
import { getSprintPlan } from "@/lib/sprint-plan";
import { listSprintOptions } from "@/lib/sprints";
import { canMutate } from "@/lib/authz";
import { assertCanAccess } from "@/lib/page-guard";

export const revalidate = 60;

type Params = { id: string };

const fmtDate = (s: string | null) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

function statusPill(status: string | null): { text: string; cls: string } {
  switch (status) {
    case "In Progress": return { text: "In Progress", cls: "bg-emerald/15 text-emerald border-emerald/30" };
    case "Next": return { text: "Next", cls: "bg-sky/15 text-sky border-sky/30" };
    case "Done": return { text: "Done", cls: "bg-violet/15 text-violet border-violet/30" };
    default: return { text: "—", cls: "bg-bg-elevated text-ink-faint border-rule" };
  }
}

export default async function SprintPlanPage({ params }: { params: Params }) {
  await assertCanAccess("/sprints");
  const editable = await canMutate();
  const [plan, sprints] = await Promise.all([
    getSprintPlan(params.id),
    listSprintOptions(),
  ]);
  if (!plan) notFound();

  const pill = statusPill(plan.sprintStatus);
  const start = fmtDate(plan.sprintStart);
  const end = fmtDate(plan.sprintEnd);

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title={`Plan ${plan.sprintNumber != null ? `Sprint #${plan.sprintNumber}` : plan.sprintName}`}
        subtitle={plan.sprintGoals ?? "Edit each engineer's capacity for this sprint, then add stories from the pool."}
        meta={
          <>
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${pill.cls}`}>
                {pill.text}
              </span>
              <Link
                href={`/sprints/${plan.sprintId}`}
                className="text-[11px] font-mono text-emerald hover:underline whitespace-nowrap"
              >
                View kanban →
              </Link>
            </div>
            <div className="font-mono tabnum">
              {start && end ? `${start} → ${end}` : start ?? "—"}
            </div>
            <a
              href={plan.airtableUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-emerald hover:underline font-mono mt-0.5 inline-block"
            >
              Open in Airtable ↗
            </a>
          </>
        }
      />
      <SprintPlanBoard plan={plan} sprints={sprints} canEdit={editable} />
    </main>
  );
}