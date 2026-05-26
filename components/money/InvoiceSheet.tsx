"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { MoneyInvoice } from "@/lib/money";
import { markInvoiceSent } from "@/lib/mutations/invoice";

type Props = {
  invoice: MoneyInvoice | null;
  onClose: () => void;
  onFilterByPayer: (payer: string) => void;
  canEdit?: boolean;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-rule last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">
        {label}
      </div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

export function InvoiceSheet({ invoice, onClose, onFilterByPayer, canEdit = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!invoice) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    setSendError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [invoice, onClose]);

  if (!invoice || !mounted) return null;

  const canSend = canEdit && invoice.status === "unsent";
  const handleSend = () => {
    if (!confirm("Flip status to \"sent\"? This will trigger Airtable's automation to actually issue the invoice.")) return;
    setSendError(null);
    startTransition(async () => {
      const res = await markInvoiceSent(invoice.id);
      if ("error" in res) setSendError(res.error);
      else onClose();
    });
  };


  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[460px] bg-surface z-50 border-l border-rule shadow-xl overflow-y-auto"
        role="dialog"
        aria-label={`Invoice ${invoice.invoiceId ?? ""}`}
      >
        <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              Invoice {invoice.invoiceId ? `#${invoice.invoiceId}` : ""}
            </div>
            <h2 className="text-[16px] font-semibold text-ink-strong leading-tight">
              {invoice.payer}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 bg-bg-elevated border-b border-rule">
          <div className="text-[34px] font-semibold text-ink-strong tabnum leading-none">
            {fmtCurrency(invoice.amount)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-muted">
            <span className="font-mono">{invoice.status ?? "—"}</span>
            <span className="text-ink-faint">·</span>
            <span>{invoice.type ?? "—"}</span>
            <span className="text-ink-faint">·</span>
            <span>{invoice.source ?? "—"}</span>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-rule flex gap-2 flex-wrap">
          {canSend && (
            <button
              type="button"
              onClick={handleSend}
              disabled={pending}
              className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {pending ? "Sending…" : "Send invoice"}
            </button>
          )}
          <a
            href={invoice.airtableUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-3 py-1.5 text-[12px] ${canSend ? "bg-bg-elevated border border-rule text-ink hover:border-ink-muted" : "bg-emerald text-bg font-medium hover:bg-emerald/80"} rounded transition-colors`}
          >
            Open in Airtable ↗
          </a>

          {invoice.stripeLink && (
            <a
              href={invoice.stripeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
            >
              Stripe Invoice ↗
            </a>
          )}
          {invoice.subscriptionLink && (
            <a
              href={invoice.subscriptionLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
            >
              Subscription Link ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => onFilterByPayer(invoice.payer)}
            className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
          >
            All from {invoice.payer.split(" ")[0]}
          </button>
        </div>

        {sendError && (
          <div className="mx-5 mt-3 text-[12px] text-red bg-red/10 border border-red/30 rounded-md px-3 py-2">
            {sendError}
          </div>
        )}



        <div className="px-5 py-2">
          <Field label="Description">{invoice.description ?? "—"}</Field>
          <Field label="Invoice Identifier">
            <span className="font-mono text-[12px]">{invoice.identifier}</span>
          </Field>
          <Field label="Date">{fmtDate(invoice.date)}</Field>
          <Field label="Created">{fmtDateTime(invoice.created)}</Field>
          <Field label="Status Last Modified">{fmtDateTime(invoice.lastModified)}</Field>
          <Field label="Margin Profit">
            {invoice.marginProfit != null ? fmtCurrency(invoice.marginProfit) : "—"}
          </Field>
          <Field label="Initial Invoice">{invoice.initial ? "Yes" : "No"}</Field>
          <Field label="Approved by Airvues Leadership">{invoice.approved ? "Yes" : "No"}</Field>
          <Field label="Stripe ID">
            {invoice.stripeId ? (
              <span className="font-mono text-[12px]">{invoice.stripeId}</span>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Linked Quotes">
            {invoice.quoteRecordIds.length === 0 ? (
              "—"
            ) : (
              <div className="flex flex-col gap-1">
                {invoice.quoteRecordIds.map((qid) => (
                  <a
                    key={qid}
                    href={`https://airvues-quote.vercel.app/?quoteId=${qid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald hover:underline text-[12px] font-mono"
                  >
                    {qid} ↗
                  </a>
                ))}
              </div>
            )}
          </Field>
          <Field label="Airtable Record ID">
            <span className="font-mono text-[12px]">{invoice.id}</span>
          </Field>
        </div>
      </aside>
    </>
  );
}
