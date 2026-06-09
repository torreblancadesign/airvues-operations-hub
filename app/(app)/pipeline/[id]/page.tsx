// Full-page quote/project detail view. Replaces the side-drawer drill-in from
// /pipeline and /me and /clients/[id]. Re-uses QuoteSheetEditor for the editable
// body, wrapped in a page-shell instead of a portal/overlay.

import Link from "next/link";
import { notFound } from "next/navigation";
import { listAllQuotes } from "@/lib/pipeline";
import { listPeopleOptions } from "@/lib/quotes";
import { listSprintOptions } from "@/lib/sprints";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuoteSheetEditor } from "@/components/pipeline/QuoteSheetEditor";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

type Params = { params: { id: string } };

export default async function QuoteDetailPage({ params }: Params) {
  await assertCanAccess("/pipeline");
  const [quotes, people, sprints, canEdit] = await Promise.all([
    listAllQuotes(),
    listPeopleOptions(),
    listSprintOptions(),
    canMutate(),
  ]);

  const quote = quotes.find((q) => q.id === params.id);
  if (!quote) notFound();

  const days = daysSince(quote.preparedDate);
  const stale =
    days != null &&
    days > 14 &&
    (quote.status === "Sent. Awaiting Approval." || quote.status === "Draft");

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <div className="mb-3 text-[11px] font-mono text-ink-faint">
        <Link href="/pipeline" className="hover:text-emerald">← All quotes</Link>
      </div>

      <PageHeader
        title={quote.projectName}
        subtitle={`Quote ${quote.autonumber ? `#${quote.autonumber}` : ""} · ${quote.client}${quote.preparedBy && quote.preparedBy !== "—" ? ` · Prepared by ${quote.preparedBy}` : ""} · ${fmtDate(quote.preparedDate)}`}

        meta={
          <div className="text-right">
            <div className="text-[24px] font-semibold tabnum text-ink-strong leading-none">
              {fmtCurrency(quote.totalCost)}
            </div>
            <div className="mt-1 text-[11px] text-ink-muted tabnum font-mono">
              {fmtCurrency(quote.totalPaid)} paid · {fmtCurrency(quote.amountOwed)} owed
            </div>
          </div>
        }
      />

      {/* Status chips */}
      <div className="mb-5 flex items-center gap-2 flex-wrap text-[12px]">
        <span className="px-2.5 py-1 bg-bg-elevated border border-rule rounded font-mono text-ink">
          <span className="text-ink-faint mr-1">Deal:</span>{quote.status ?? "—"}
        </span>
        <span className="px-2.5 py-1 bg-bg-elevated border border-rule rounded text-ink">
          <span className="text-ink-faint mr-1">Journey:</span>{quote.projectStatus ?? "—"}
        </span>
        {quote.proposalType && (
          <span className="px-2.5 py-1 bg-bg-elevated border border-rule rounded text-ink">
            {quote.proposalType}
          </span>
        )}
        {quote.totalHours != null && (
          <span className="px-2.5 py-1 bg-bg-elevated border border-rule rounded font-mono text-ink">
            {quote.totalHours}h
          </span>
        )}
        {stale && (
          <span className="px-2.5 py-1 bg-red-soft text-red border border-red/30 rounded font-medium">
            Stalled {days}d
          </span>
        )}
        <span className="ml-auto flex gap-2">
          <a
            href={quote.webQuoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-medium rounded hover:bg-emerald/80 transition-colors"
          >
            Web Quote ↗
          </a>
          <a
            href={quote.airtableUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
          >
            Airtable ↗
          </a>
        </span>
      </div>

      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <QuoteSheetEditor
          quoteId={quote.id}
          people={people}
          sprints={sprints}
          canEdit={canEdit}
        />
      </div>
    </main>
  );
}
