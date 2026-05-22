// Backlog — Phase A of the agile build.
// Flat table of all stories, defaults to "orphan stories" filter so the 528
// unassigned items are the first thing you see. Bulk actions on selected rows.
// Drawer inline-edits status / priority / hours / assignee.
import { PageHeader } from "@/components/ui/PageHeader";
import { BacklogList } from "@/components/backlog/BacklogList";
import { getEngineeringBoard } from "@/lib/engineering";
import { listQuoteOptions, type QuoteOption } from "@/lib/quotes-light";
import { canMutate } from "@/lib/authz";
import type { BacklogFilter } from "@/components/backlog/types";
import { assertCanAccess } from "@/lib/page-guard";

export const revalidate = 60;

type SearchParams = { scope?: string; engineer?: string; client?: string };

const VALID_SCOPES = new Set<BacklogFilter["scope"]>([
  "orphan",
  "active",
  "all",
  "todo",
  "in-progress",
  "qa",
  "done",
]);

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await assertCanAccess("/backlog");
  const sp = await searchParams;
  const initialFilter: Partial<BacklogFilter> = {};
  if (sp.scope && VALID_SCOPES.has(sp.scope as BacklogFilter["scope"])) {
    initialFilter.scope = sp.scope as BacklogFilter["scope"];
  }
  if (sp.engineer) initialFilter.engineerId = sp.engineer;
  if (sp.client) initialFilter.client = sp.client;

  let data;
  let quotes: QuoteOption[] = [];
  try {
    data = await getEngineeringBoard();
    quotes = await listQuoteOptions();
  } catch (err) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader title="Backlog" />
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load backlog: {(err as Error).message}
        </div>
      </main>
    );
  }

  // Flatten stories — each story appears once even if it has multiple assignees.
  // (groups contain duplicates when a story has 2+ assignees; dedupe by record id.)
  const seen = new Set<string>();
  const stories = [];
  for (const g of data.groups) {
    for (const s of g.stories) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      stories.push(s);
    }
  }

  const engineersWithWork = data.groups
    .filter((g) => !g.isOrphan)
    .map((g) => ({ id: g.id, name: g.name }));

  const assignableEngineers = [...data.assignablePeople]
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const editable = await canMutate();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Backlog & Refinement"
        subtitle="All stories in one table. Click a row to edit inline. Bulk-select to triage in batches."
        meta={
          <>
            <div className="font-mono tabnum">
              {stories.length.toLocaleString()} stories · {data.totals.orphanStories.toLocaleString()} orphan
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {editable ? "Write access · admin + lead" : "Read-only · sign in as admin to edit"}
            </div>
          </>
        }
      />
      <BacklogList
        stories={stories}
        engineers={engineersWithWork}
        assignableEngineers={assignableEngineers}
        clients={data.clients}
        quotes={quotes}
        canEdit={editable}
        initialFilter={initialFilter}
      />
    </main>
  );
}