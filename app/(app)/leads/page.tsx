// Leads page — inbound demand, intro meetings, conversion. Server fetcher → client dashboard.

import { listAllLeads } from "@/lib/leads";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadsDashboard } from "@/components/leads/LeadsDashboard";
import type { Filter } from "@/components/leads/types";
import type { LeadStatus, LeadBudget, LeadSource } from "@/lib/leads";
import { assertCanAccess } from "@/lib/page-guard";

type SearchParams = { status?: string; source?: string; budget?: string };

const VALID_STATUS = new Set<LeadStatus>(["New Lead", "Needs Review", "In Proposal Stage", "Sold", "Not Sold"]);
const VALID_SOURCE = new Set<LeadSource>(["Manually Scheduled", "From Fillout"]);
const VALID_BUDGET = new Set<LeadBudget>(["<$500", "$1000 - $2000", "$5000+"]);

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await assertCanAccess("/leads");
  const sp = await searchParams;
  const initialFilter: Partial<Filter> = {};
  if (sp.status && VALID_STATUS.has(sp.status as LeadStatus)) initialFilter.status = sp.status as LeadStatus;
  if (sp.source && VALID_SOURCE.has(sp.source as LeadSource)) initialFilter.source = sp.source as LeadSource;
  if (sp.budget && VALID_BUDGET.has(sp.budget as LeadBudget)) initialFilter.budget = sp.budget as LeadBudget;

  let leads: Awaited<ReturnType<typeof listAllLeads>> = [];
  let error: string | null = null;
  try {
    leads = await listAllLeads();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Leads"
        subtitle="Inbound demand · intro meetings · conversion. Click any row to drill in."
        meta={
          <>
            <div className="font-mono tabnum">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {leads.length.toLocaleString()} leads loaded · 5-min cache
            </div>
          </>
        }
      />

      {error ? (
        <div className="bg-red-soft border border-red/30 rounded-card p-4 text-[13px] text-red">
          ⚠ Failed to load leads: {error}
        </div>
      ) : (
        <LeadsDashboard leads={leads} initialFilter={initialFilter} />
      )}
    </main>
  );
}