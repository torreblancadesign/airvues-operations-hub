"use client";

import { useEffect } from "react";
import { PipelineQuote } from "@/lib/pipeline";

type Props = {
  quote: PipelineQuote | null;
  onClose: () => void;
  onFilterByClient: (client: string) => void;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-rule last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">{label}</div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function QuoteSheet({ quote, onClose, onFilterByClient }: Props) {
  useEffect(() => {
    if (!quote) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quote, onClose]);

  if (!quote) return null;

  const days = daysSince(quote.preparedDate);
  const stale = days != null && days > 14 && (quote.status === "Sent. Awaiting Approval." || quote.status === "Draft");

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-surface z-50 border-l border-rule shadow-xl overflow-y-auto" role="dialog">
        <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              Quote {quote.autonumber ? `#${quote.autonumber}` : ""}
            </div>
            <h2 className="text-[16px] font-semibold text-ink-strong leading-tight max-w-[340px]">{quote.projectName}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated" aria-label="Close">×</button>
        </div>

        <div className="px-5 py-5 bg-bg-elevated border-b border-rule">
          <div className="text-[34px] font-semibold text-ink-strong tabnum leading-none">{fmtCurrency(quote.totalCost)}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-muted">
            <span className="font-mono">{quote.status ?? "—"}</span>
            <span className="text-ink-faint">·</span>
            <span>{quote.proposalType ?? "—"}</span>
            {quote.totalHours != null && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="font-mono">{quote.totalHours}h</span>
              </>
            )}
          </div>
          {stale && (
            <div className="mt-3 inline-block px-2 py-1 bg-red-soft text-red rounded text-[11px] font-medium">
              Stalled {days}d
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-b border-rule flex gap-2 flex-wrap">
          <a href={quote.webQuoteUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-medium rounded hover:bg-emerald/80 transition-colors">Web Quote ↗</a>
          <a href={quote.airtableUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">Airtable ↗</a>
          <button type="button" onClick={() => onFilterByClient(quote.client)} className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">All from {quote.client.split(" ")[0]}</button>
        </div>

        <div className="px-5 py-2">
          <Field label="Client">{quote.client}</Field>
          <Field label="Prepared by">{quote.preparedBy}</Field>
          <Field label="Prepared date">{fmtDate(quote.preparedDate)}</Field>
          <Field label="Signed date">{fmtDate(quote.signedDate)}</Field>
          <Field label="Days since prepared">{days != null ? `${days} days` : "—"}</Field>
          <Field label="Expiration">{fmtDate(quote.expirationDate)}</Field>
          <Field label="Delivery due">{fmtDate(quote.deliveryDueDate)}</Field>
          <Field label="Project status">{quote.projectStatus ?? "—"}</Field>
          <Field label="Stories">{quote.storiesCount} line item{quote.storiesCount === 1 ? "" : "s"}</Field>
          <Field label="Total hours">{quote.totalHours != null ? quote.totalHours : "—"}</Field>
          <Field label="Total paid">{fmtCurrency(quote.totalPaid)}</Field>
          <Field label="Amount owed">{fmtCurrency(quote.amountOwed)}</Field>
          <Field label="Quote last viewed">{fmtDateTime(quote.quoteLastAccess)}</Field>
          <Field label="Primary email">{quote.primaryEmail ?? "—"}</Field>
          <Field label="Airtable Record ID"><span className="font-mono text-[12px]">{quote.id}</span></Field>
        </div>
      </aside>
    </>
  );
}
