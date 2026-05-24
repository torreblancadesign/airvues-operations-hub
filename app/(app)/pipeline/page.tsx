// Pipeline page — Sales pipeline & conversion. Server fetcher hands off to client dashboard.

import { listAllQuotes } from "@/lib/pipeline";
import { listPeopleOptions } from "@/lib/quotes";
import { PageHeader } from "@/components/ui/PageHeader";
import { PipelineDashboard } from "@/components/pipeline/PipelineDashboard";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";

export default async function PipelinePage() {
  await assertCanAccess("/pipeline");
  let quotes: Awaited<ReturnType<typeof listAllQuotes>> = [];
  let people: Awaited<ReturnType<typeof listPeopleOptions>> = [];
  let error: string | null = null;
  try {
    [quotes, people] = await Promise.all([listAllQuotes(), listPeopleOptions()]);
  } catch (e) {
    error = (e as Error).message;
  }
  const canEdit = await canMutate();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Pipeline"
        subtitle="All quotes · stages, conversion, stalled deals. Click any row to drill in."
        meta={
          <>
            <div className="font-mono tabnum">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {quotes.length.toLocaleString()} quotes loaded · 5-min cache
            </div>
          </>
        }
      />

      {error ? (
        <div className="bg-red-soft border border-red/30 rounded-card p-4 text-[13px] text-red">
          ⚠ Failed to load quotes: {error}
        </div>
      ) : (
        <PipelineDashboard quotes={quotes} people={people} canEdit={canEdit} />
      )}
    </main>
  );
}
