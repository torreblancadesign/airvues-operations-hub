// Pipeline page — Sales pipeline & conversion. Server fetcher hands off to client dashboard.

import { listAllQuotes } from "@/lib/pipeline";
import { listPeopleOptions } from "@/lib/quotes";
import { listSprintOptions } from "@/lib/sprints";
import { PageHeader } from "@/components/ui/PageHeader";
import { PipelineDashboard } from "@/components/pipeline/PipelineDashboard";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";

type SP = { deadlineRisk?: string; stage?: string; stalled?: string };

export default async function PipelinePage({ searchParams }: { searchParams?: SP }) {
  await assertCanAccess("/pipeline");
  let quotes: Awaited<ReturnType<typeof listAllQuotes>> = [];
  let people: Awaited<ReturnType<typeof listPeopleOptions>> = [];
  let sprints: Awaited<ReturnType<typeof listSprintOptions>> = [];
  let error: string | null = null;
  try {
    [quotes, people, sprints] = await Promise.all([
      listAllQuotes(),
      listPeopleOptions(),
      listSprintOptions(),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }
  const canEdit = await canMutate();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Projects"
        subtitle="All quotes & projects. Filter to find anything fast. Click any row to drill in."
        meta={
          <>
            <div className="font-mono tabnum">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {quotes.length.toLocaleString()} quotes loaded · 5-min cache
            </div>
            {canEdit && (
              <a
                href="/clients"
                className="mt-2 inline-block px-3 py-1 text-[11px] rounded font-medium uppercase tracking-wider bg-emerald text-bg hover:bg-emerald/80"
                title="Open the Clients page and click 'New proposal' on the account"
              >
                + New proposal
              </a>
            )}
          </>
        }
      />

      {error ? (
        <div className="bg-red-soft border border-red/30 rounded-card p-4 text-[13px] text-red">
          ⚠ Failed to load quotes: {error}
        </div>
      ) : (
        <PipelineDashboard
          quotes={quotes}
          people={people}
          sprints={sprints}
          canEdit={canEdit}
          initialFilter={{
            deadlineRisk:
              searchParams?.deadlineRisk === "needs-attention" ||
              searchParams?.deadlineRisk === "overdue" ||
              searchParams?.deadlineRisk === "red" ||
              searchParams?.deadlineRisk === "yellow"
                ? (searchParams.deadlineRisk as "needs-attention" | "overdue" | "red" | "yellow")
                : "all",
            stalledOnly: searchParams?.stalled === "1",
          }}
        />
      )}
    </main>
  );
}
