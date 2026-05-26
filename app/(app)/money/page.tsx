// Money — full operational dashboard with drill-in.
// Server component: bulk-fetch all invoices ONCE, hand off to client for filter/sort/sheet.
// Accepts ?status= and ?type= so home KPI tiles can deep-link into filtered views.

import { listAllInvoices } from "@/lib/money";
import { listPayerOptions } from "@/lib/people-light";
import { listQuoteOptions } from "@/lib/quotes-light";
import { PageHeader } from "@/components/ui/PageHeader";
import { MoneyDashboard } from "@/components/money/MoneyDashboard";
import type { Filter, StatusBucket } from "@/components/money/types";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";

type SearchParams = { status?: string; type?: string; source?: string; payer?: string };

const VALID_STATUS = new Set<StatusBucket>(["all", "paid", "open", "overdue", "subscribed", "void"]);
const VALID_TYPE = new Set<Filter["type"]>(["all", "One-time", "Recurring", "Payment Plan"]);
const VALID_SOURCE = new Set<Filter["source"]>(["all", "Stripe", "Fiverr", "Other"]);

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await assertCanAccess("/money");
  const sp = await searchParams;
  const initialFilter: Partial<Filter> = {};
  if (sp.status && VALID_STATUS.has(sp.status as StatusBucket)) {
    initialFilter.status = sp.status as StatusBucket;
  }
  if (sp.type && VALID_TYPE.has(sp.type as Filter["type"])) {
    initialFilter.type = sp.type as Filter["type"];
  }
  if (sp.source && VALID_SOURCE.has(sp.source as Filter["source"])) {
    initialFilter.source = sp.source as Filter["source"];
  }
  if (sp.payer) initialFilter.payer = sp.payer;

  let invoices: Awaited<ReturnType<typeof listAllInvoices>> = [];
  let payers: Awaited<ReturnType<typeof listPayerOptions>> = [];
  let quotes: Awaited<ReturnType<typeof listQuoteOptions>> = [];
  let error: string | null = null;
  try {
    [invoices, payers, quotes] = await Promise.all([
      listAllInvoices(),
      listPayerOptions().catch(() => []),
      listQuoteOptions().catch(() => []),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  const canEdit = await canMutate();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Money"
        subtitle="All invoices · filter, sort, drill in. Click any row to see full detail."
        meta={
          <>
            <div className="font-mono tabnum">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {invoices.length.toLocaleString()} invoices loaded · 5-min cache
            </div>
          </>
        }
      />

      {error ? (
        <div className="bg-signal-down/10 border border-signal-down/30 rounded-md p-4 text-[13px] text-signal-down">
          ⚠ Failed to load invoices: {error}
        </div>
      ) : (
        <MoneyDashboard
          invoices={invoices}
          initialFilter={initialFilter}
          canEdit={canEdit}
          payers={payers}
          quotes={quotes}
        />
      )}
    </main>
  );
}
