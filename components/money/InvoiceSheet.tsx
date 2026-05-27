"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoneyInvoice } from "@/lib/money";
import {
  markInvoiceSent,
  updateInvoice,
  type UpdateInvoiceInput,
} from "@/lib/mutations/invoice";

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

const inputCls =
  "w-full px-2 py-1 text-[13px] bg-bg border border-rule text-ink rounded focus:border-emerald focus:outline-none disabled:opacity-60";

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="py-2.5 border-b border-rule last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        {hint && <div className="text-[10px] text-ink-faint">{hint}</div>}
      </div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

export function InvoiceSheet({ invoice, onClose, onFilterByPayer, canEdit = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
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
    setEditError(null);
    setSavedKey(null);
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

  const save = (key: string, patch: UpdateInvoiceInput) => {
    setEditError(null);
    startTransition(async () => {
      const res = await updateInvoice(invoice.id, patch);
      if ("error" in res) setEditError(res.error);
      else {
        setSavedKey(key);
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
      }
    });
  };

  // Field-level editor primitives — always editable, save on blur/change.
  const TextEditor = ({
    field,
    initial,
    multiline,
    maxLength,
    transform,
  }: {
    field: keyof UpdateInvoiceInput;
    initial: string;
    multiline?: boolean;
    maxLength?: number;
    transform?: (v: string) => UpdateInvoiceInput[keyof UpdateInvoiceInput];
  }) => {
    const [v, setV] = useState(initial);
    useEffect(() => setV(initial), [initial]);
    const commit = () => {
      if (v === initial) return;
      const value = transform ? transform(v) : (v as never);
      save(field, { [field]: value } as UpdateInvoiceInput);
    };
    if (multiline) {
      return (
        <textarea
          rows={3}
          maxLength={maxLength}
          className={`${inputCls} resize-y`}
          value={v}
          disabled={!canEdit || pending}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
        />
      );
    }
    return (
      <input
        type="text"
        maxLength={maxLength}
        className={inputCls}
        value={v}
        disabled={!canEdit || pending}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
      />
    );
  };

  const NumberEditor = ({
    field,
    initial,
    min,
    max,
    step,
    suffix,
    transform,
  }: {
    field: keyof UpdateInvoiceInput;
    initial: string;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    transform: (v: string) => UpdateInvoiceInput[keyof UpdateInvoiceInput];
  }) => {
    const [v, setV] = useState(initial);
    useEffect(() => setV(initial), [initial]);
    const commit = () => {
      if (v === initial) return;
      save(field, { [field]: transform(v) } as UpdateInvoiceInput);
    };
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          className={`${inputCls} font-mono tabnum`}
          value={v}
          disabled={!canEdit || pending}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
        />
        {suffix && <span className="text-[12px] text-ink-muted">{suffix}</span>}
      </div>
    );
  };

  const SelectEditor = ({
    field,
    initial,
    options,
    transform,
  }: {
    field: keyof UpdateInvoiceInput;
    initial: string;
    options: { value: string; label: string }[];
    transform: (v: string) => UpdateInvoiceInput[keyof UpdateInvoiceInput];
  }) => (
    <select
      className={inputCls}
      value={initial}
      disabled={!canEdit || pending}
      onChange={(e) => save(field, { [field]: transform(e.target.value) } as UpdateInvoiceInput)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const savedHint = (key: string) => (savedKey === key ? "✓ saved" : undefined);

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} aria-hidden="true" />

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
            <h2 className="text-[16px] font-semibold text-ink-strong leading-tight">{invoice.payer}</h2>
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
        {editError && (
          <div className="mx-5 mt-3 text-[12px] text-red bg-red/10 border border-red/30 rounded-md px-3 py-2">
            {editError}
          </div>
        )}

        <div className="px-5 py-2">
          <Row label="Amount" hint={savedHint("amount")}>
            <NumberEditor
              field="amount"
              initial={String(invoice.amount)}
              min={0}
              step={0.01}
              transform={(v) => parseFloat(v)}
            />
          </Row>

          <Row label="Date" hint={savedHint("date")}>
            <input
              type="date"
              className={`${inputCls} font-mono`}
              defaultValue={invoice.date ?? ""}
              disabled={!canEdit || pending}
              onBlur={(e) => {
                if (e.target.value !== (invoice.date ?? "")) save("date", { date: e.target.value });
              }}
            />
          </Row>

          <Row label="Description" hint={savedHint("description")}>
            <TextEditor
              field="description"
              initial={invoice.description ?? ""}
              multiline
              maxLength={1000}
              transform={(v) => (v.trim() || null) as never}
            />
          </Row>

          <Row label="Type" hint={savedHint("type")}>
            <SelectEditor
              field="type"
              initial={invoice.type ?? "One-time"}
              options={[
                { value: "One-time", label: "One-time" },
                { value: "Recurring", label: "Recurring" },
                { value: "Payment Plan", label: "Payment Plan" },
              ]}
              transform={(v) => v as "One-time" | "Recurring" | "Payment Plan"}
            />
          </Row>

          <Row label="Source" hint={savedHint("source")}>
            <SelectEditor
              field="source"
              initial={invoice.source ?? "Stripe"}
              options={[
                { value: "Stripe", label: "Stripe" },
                { value: "Fiverr", label: "Fiverr" },
                { value: "Other", label: "Other" },
              ]}
              transform={(v) => v as "Stripe" | "Fiverr" | "Other"}
            />
          </Row>

          {invoice.type !== "One-time" && (
            <Row label="Need Client Approval for Subscription" hint={savedHint("needsClientApproval")}>
              <SelectEditor
                field="needsClientApproval"
                initial={invoice.needsClientApproval ?? ""}
                options={[
                  { value: "", label: "—" },
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                transform={(v) => (v || null) as "Yes" | "No" | null}
              />
            </Row>
          )}

          {invoice.type === "Payment Plan" && (
            <>
              <Row label="Payment Plan — # of Payments" hint={savedHint("paymentPlanCount")}>
                <NumberEditor
                  field="paymentPlanCount"
                  initial={invoice.paymentPlanCount?.toString() ?? ""}
                  min={1}
                  max={120}
                  transform={(v) => (v === "" ? null : parseInt(v, 10))}
                />
              </Row>

              <Row label="Payment Plan — Frequency" hint={savedHint("paymentPlanFrequency")}>
                <SelectEditor
                  field="paymentPlanFrequency"
                  initial={invoice.paymentPlanFrequency ?? ""}
                  options={[
                    { value: "", label: "—" },
                    { value: "weekly", label: "weekly" },
                    { value: "biweekly", label: "biweekly" },
                    { value: "monthly", label: "monthly" },
                  ]}
                  transform={(v) => (v || null) as "weekly" | "biweekly" | "monthly" | null}
                />
              </Row>
            </>
          )}

          <Row label="Discount %" hint={savedHint("discountPercent")}>
            <NumberEditor
              field="discountPercent"
              initial={invoice.discountPercent != null ? (invoice.discountPercent * 100).toString() : ""}
              min={0}
              max={100}
              step={0.1}
              suffix="%"
              transform={(v) => (v === "" ? null : parseFloat(v) / 100)}
            />
          </Row>

          <Row label="Discount Length (# of payments)" hint={savedHint("discountLength")}>
            <NumberEditor
              field="discountLength"
              initial={invoice.discountLength?.toString() ?? ""}
              min={0}
              max={120}
              transform={(v) => (v === "" ? null : parseInt(v, 10))}
            />
          </Row>

          {invoice.source === "Fiverr" && (
            <Row label="Fiverr Status" hint={savedHint("fiverrStatus")}>
              <SelectEditor
                field="fiverrStatus"
                initial={invoice.fiverrStatus ?? ""}
                options={[
                  { value: "", label: "—" },
                  { value: "Gig Pending Acceptance", label: "Gig Pending Acceptance" },
                  { value: "Gig Accepted", label: "Gig Accepted" },
                  { value: "Gig Funds Cleared", label: "Gig Funds Cleared" },
                ]}
                transform={(v) =>
                  (v || null) as
                    | "Gig Pending Acceptance"
                    | "Gig Accepted"
                    | "Gig Funds Cleared"
                    | null
                }
              />
            </Row>
          )}

          {/* Read-only fields */}
          <Row label="Payer">{invoice.payer}</Row>
          <Row label="Client Stripe Status">{invoice.clientStripeStatus ?? "—"}</Row>
          <Row label="Invoice Stripe ID">
            {invoice.stripeId ? (
              <span className="font-mono text-[12px]">{invoice.stripeId}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Subscription Stripe ID">
            {invoice.subscriptionStripeId ? (
              <span className="font-mono text-[12px]">{invoice.subscriptionStripeId}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Invoice Identifier">
            <span className="font-mono text-[12px]">{invoice.identifier}</span>
          </Row>
          <Row label="Created">{fmtDateTime(invoice.created)}</Row>
          <Row label="Status Last Modified">{fmtDateTime(invoice.lastModified)}</Row>
          <Row label="Margin Profit">
            {invoice.marginProfit != null ? fmtCurrency(invoice.marginProfit) : "—"}
          </Row>
          <Row label="Initial Invoice">{invoice.initial ? "Yes" : "No"}</Row>
          <Row label="Approved by Airvues Leadership">{invoice.approved ? "Yes" : "No"}</Row>
          <Row label="Linked Quotes">
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
          </Row>
          <Row label="Airtable Record ID">
            <span className="font-mono text-[12px]">{invoice.id}</span>
          </Row>
        </div>
      </aside>
    </>,
    document.body,
  );
}
