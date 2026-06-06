"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useState } from "react";
import { PipelineQuote } from "@/lib/pipeline";
import type { PersonOption } from "@/lib/quote-types";
import { QuoteSheetEditor } from "./QuoteSheetEditor";
import { DrawerErrorBoundary } from "./DrawerErrorBoundary";


type Props = {
  quote: PipelineQuote | null;
  people: PersonOption[];
  canEdit: boolean;
  onClose: () => void;
  onFilterByClient: (client: string) => void;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function QuoteSheet({ quote, people, canEdit, onClose, onFilterByClient }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!quote) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [quote]);

  useEffect(() => {
    if (!quote) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quote, onClose]);

  if (!quote || !mounted) return null;

  const days = daysSince(quote.preparedDate);
  const stale = days != null && days > 14 && (quote.status === "Sent. Awaiting Approval." || quote.status === "Draft");

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[640px] bg-surface z-50 border-l border-rule shadow-xl overflow-y-auto"
        role="dialog"
      >
        <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              Quote {quote.autonumber ? `#${quote.autonumber}` : ""}
            </div>
            <h2 className="text-[16px] font-semibold text-ink-strong leading-tight truncate">
              {quote.projectName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Header strip — keep the at-a-glance numbers */}
        <div className="px-5 py-4 bg-bg-elevated border-b border-rule">
          <div className="text-[28px] font-semibold text-ink-strong tabnum leading-none">
            {fmtCurrency(quote.totalCost)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-muted flex-wrap">
            <span
              className="font-mono"
              title="Deal Stage — internal sales pipeline. Not shown to client."
            >
              <span className="text-ink-faint mr-1">Deal:</span>
              {quote.status ?? "—"}
            </span>
            <span className="text-ink-faint">·</span>
            <span
              title="Client Journey — client-visible delivery milestone."
            >
              <span className="text-ink-faint mr-1">Journey:</span>
              {quote.projectStatus ?? "—"}
            </span>
            <span className="text-ink-faint">·</span>
            <span>{quote.proposalType ?? "—"}</span>
            {quote.totalHours != null && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="font-mono">{quote.totalHours}h</span>
              </>
            )}
            <span className="text-ink-faint">·</span>
            <span>{quote.client}</span>
          </div>
          {stale && (
            <div className="mt-2.5 inline-block px-2 py-1 bg-red-soft text-red rounded text-[11px] font-medium">
              Stalled {days}d
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 py-3 border-b border-rule flex gap-2 flex-wrap">
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
          <button
            type="button"
            onClick={() => onFilterByClient(quote.client)}
            className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
          >
            All from {quote.client.split(" ")[0]}
          </button>
        </div>

        {/* Editable body */}
        <QuoteSheetErrorBoundary airtableUrl={quote.airtableUrl} onClose={onClose}>
          <QuoteSheetEditor quoteId={quote.id} people={people} canEdit={canEdit} />
        </QuoteSheetErrorBoundary>

      </aside>
    </>,
    document.body,
  );
}
