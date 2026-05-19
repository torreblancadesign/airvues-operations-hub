// /sprints/[id] — kanban board for one sprint.
// 4 columns by Story Status. Quick-advance button on each card moves to the next column.
// Click a card → drawer for full edit (status / priority / hours / assignee).
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SprintBoard } from "@/components/sprints/SprintBoard";
import { getSprintDetail } from "@/lib/sprints";
import { getEngineeringBoard } from "@/lib/engineering";
import { canMutate } from "@/lib/authz";

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

export default async function SprintDetailPage({ params }: { params: Params }) {
  const editable = await canMutate();
  const [sprint, board] = await Promise.all([
    getSprintDetail(params.id),
    getEngineeringBoard(),
  ]);

  if (!sprint) notFound();

  const engineers = board.groups
    .filter((g) => !g.isOrphan)
    .map((g) => ({ id: g.id, name: g.name }));

  const pill = statusPill(sprint.status);
  const start = fmtDate(sprint.start);
  const end = fmtDate(sprint.end);

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title={sprint.number != null ? `Sprint #${sprint.number}` : sprint.name}
        subtitle={sprint.goals ?? undefined}
        meta={
          <>
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${pill.cls}`}>
                {pill.text}
              </span>
              <Link
                href={`/sprints/${sprint.id}/plan`}
                className="text-[11px] font-mono text-emerald hover:underline whitespace-nowrap"
              >
                Plan sprint →
              </Link>
            </div>
            <div className="font-mono tabnum">
              {start && end ? `${start} → ${end}` : start ?? "—"}
            </div>
            <a
              href={sprint.airtableUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-emerald hover:underline font-mono mt-0.5 inline-block"
            >
              Open in Airtable ↗
            </a>
          </>
        }
      />
      <SprintBoard sprint={sprint} engineers={engineers} canEdit={editable} />
    </main>
  );
}
