// Retainer Timesheets — engineer-facing surface for logging stories against
// any active retainer. Reuses the QuoteStoriesTable used inside the Projects
// drawer, with the same monthly + tag sub-grouping behavior.
import { PageHeader } from "@/components/ui/PageHeader";
import { RetainerTimesheetsPage } from "@/components/engineering/RetainerTimesheetsPage";
import { listRetainers } from "@/lib/retainer-timesheets";
import { getQuoteDetail, listPeopleOptions } from "@/lib/quotes";
import { canMutate } from "@/lib/authz";
import { assertCanAccess } from "@/lib/page-guard";

export const revalidate = 300;

type SP = { retainer?: string };

export default async function RetainerTimesheetsRoute({
  searchParams,
}: {
  searchParams?: SP;
}) {
  await assertCanAccess("/engineering/retainer-timesheets");

  const retainerParam = typeof searchParams?.retainer === "string" ? searchParams.retainer : null;
  const validSelected = retainerParam && retainerParam.startsWith("rec") ? retainerParam : null;

  let retainers: Awaited<ReturnType<typeof listRetainers>> = [];
  let people: Awaited<ReturnType<typeof listPeopleOptions>> = [];
  let error: string | null = null;

  try {
    [retainers, people] = await Promise.all([listRetainers(), listPeopleOptions()]);
  } catch (e) {
    error = (e as Error).message;
  }

  let selectedQuote = null;
  if (validSelected && retainers.some((r) => r.id === validSelected)) {
    try {
      selectedQuote = await getQuoteDetail(validSelected);
    } catch (e) {
      error = error ?? (e as Error).message;
    }
  }

  const canEdit = await canMutate();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Retainer Timesheets"
        subtitle="Pick any retainer, log the stories you delivered. Groups by month, then by tag."
        meta={
          <>
            <div className="font-mono tabnum">
              {retainers.length} retainer{retainers.length === 1 ? "" : "s"}
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
        <RetainerTimesheetsPage
          retainers={retainers}
          selectedId={validSelected}
          selectedQuote={selectedQuote}
          people={people}
          canEdit={canEdit}
        />
      )}
    </main>
  );
}
