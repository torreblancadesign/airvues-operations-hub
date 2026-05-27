"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const inputCls =
  "w-full px-2 py-1 text-[13px] bg-bg border border-rule text-ink rounded focus:border-emerald focus:outline-none";

function Row({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-rule last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        {action}
      </div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

type EditState =
  | null
  | {
      field: keyof UpdateInvoiceInput;
      value: string;
    };

export function InvoiceSheet({ invoice, onClose, onFilterByPayer, canEdit = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>(null);
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
    setEdit(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (edit) setEdit(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [invoice, onClose, edit]);

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

  const save = (patch: UpdateInvoiceInput) => {
    setEditError(null);
    startTransition(async () => {
      const res = await updateInvoice(invoice.id, patch);
      if ("error" in res) setEditError(res.error);
      else setEdit(null);
    });
  };

  const EditBtn = ({ field, current }: { field: keyof UpdateInvoiceInput; current: string }) =>
    canEdit ? (
      <button
        type="button"
        onClick={() => {
          setEditError(null);
          setEdit({ field, value: current });
        }}
        className="text-[10px] text-emerald hover:underline"
      >
        Edit
      </button>
    ) : null;

  const CancelSave = ({ onSave }: { onSave: () => void }) => (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="px-2 py-1 text-[11px] bg-emerald text-bg font-semibold rounded disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEdit(null)}
        disabled={pending}
        className="px-2 py-1 text-[11px] border border-rule text-ink-muted rounded"
      >
        Cancel
      </button>
    </div>
  );

  const isEditing = (f: keyof UpdateInvoiceInput) => edit?.field === f;
  const editVal = edit?.value ?? "";

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
          {/* Amount */}
          <Row label="Amount" action={<EditBtn field="amount" current={String(invoice.amount)} />}>
            {isEditing("amount") ? (
              <>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${inputCls} font-mono tabnum`}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "amount", value: e.target.value })}
                  autoFocus
                />
                <CancelSave onSave={() => save({ amount: parseFloat(editVal) })} />
              </>
            ) : (
              fmtCurrency(invoice.amount)
            )}
          </Row>

          {/* Date */}
          <Row label="Date" action={<EditBtn field="date" current={invoice.date ?? ""} />}>
            {isEditing("date") ? (
              <>
                <input
                  type="date"
                  className={`${inputCls} font-mono`}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "date", value: e.target.value })}
                  autoFocus
                />
                <CancelSave onSave={() => save({ date: editVal })} />
              </>
            ) : (
              fmtDate(invoice.date)
            )}
          </Row>

          {/* Description */}
          <Row
            label="Description"
            action={<EditBtn field="description" current={invoice.description ?? ""} />}
          >
            {isEditing("description") ? (
              <>
                <textarea
                  rows={3}
                  maxLength={1000}
                  className={`${inputCls} resize-y`}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "description", value: e.target.value })}
                  autoFocus
                />
                <CancelSave onSave={() => save({ description: editVal.trim() || null })} />
              </>
            ) : (
              invoice.description ?? "—"
            )}
          </Row>

          {/* Type */}
          <Row label="Type" action={<EditBtn field="type" current={invoice.type ?? "One-time"} />}>
            {isEditing("type") ? (
              <>
                <select
                  className={inputCls}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "type", value: e.target.value })}
                  autoFocus
                >
                  <option value="One-time">One-time</option>
                  <option value="Recurring">Recurring</option>
                  <option value="Payment Plan">Payment Plan</option>
                </select>
                <CancelSave onSave={() => save({ type: editVal as "One-time" | "Recurring" | "Payment Plan" })} />
              </>
            ) : (
              invoice.type ?? "—"
            )}
          </Row>

          {/* Source */}
          <Row label="Source" action={<EditBtn field="source" current={invoice.source ?? "Stripe"} />}>
            {isEditing("source") ? (
              <>
                <select
                  className={inputCls}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "source", value: e.target.value })}
                  autoFocus
                >
                  <option value="Stripe">Stripe</option>
                  <option value="Fiverr">Fiverr</option>
                  <option value="Other">Other</option>
                </select>
                <CancelSave onSave={() => save({ source: editVal as "Stripe" | "Fiverr" | "Other" })} />
              </>
            ) : (
              invoice.source ?? "—"
            )}
          </Row>

          {/* Need Client Approval */}
          <Row
            label="Need Client Approval for Subscription"
            action={
              <EditBtn
                field="needsClientApproval"
                current={invoice.needsClientApproval ?? ""}
              />
            }
          >
            {isEditing("needsClientApproval") ? (
              <>
                <select
                  className={inputCls}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "needsClientApproval", value: e.target.value })}
                  autoFocus
                >
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                <CancelSave
                  onSave={() =>
                    save({ needsClientApproval: (editVal || null) as "Yes" | "No" | null })
                  }
                />
              </>
            ) : (
              invoice.needsClientApproval ?? "—"
            )}
          </Row>

          {/* Payment Plan - Number */}
          <Row
            label="Payment Plan — # of Payments"
            action={
              <EditBtn
                field="paymentPlanCount"
                current={invoice.paymentPlanCount?.toString() ?? ""}
              />
            }
          >
            {isEditing("paymentPlanCount") ? (
              <>
                <input
                  type="number"
                  min="1"
                  max="120"
                  className={`${inputCls} font-mono tabnum`}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "paymentPlanCount", value: e.target.value })}
                  autoFocus
                />
                <CancelSave
                  onSave={() =>
                    save({ paymentPlanCount: editVal === "" ? null : parseInt(editVal, 10) })
                  }
                />
              </>
            ) : (
              invoice.paymentPlanCount ?? "—"
            )}
          </Row>

          {/* Payment Plan - Frequency */}
          <Row
            label="Payment Plan — Frequency"
            action={
              <EditBtn
                field="paymentPlanFrequency"
                current={invoice.paymentPlanFrequency ?? ""}
              />
            }
          >
            {isEditing("paymentPlanFrequency") ? (
              <>
                <select
                  className={inputCls}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "paymentPlanFrequency", value: e.target.value })}
                  autoFocus
                >
                  <option value="">—</option>
                  <option value="weekly">weekly</option>
                  <option value="biweekly">biweekly</option>
                  <option value="monthly">monthly</option>
                </select>
                <CancelSave
                  onSave={() =>
                    save({
                      paymentPlanFrequency:
                        (editVal || null) as "weekly" | "biweekly" | "monthly" | null,
                    })
                  }
                />
              </>
            ) : (
              invoice.paymentPlanFrequency ?? "—"
            )}
          </Row>

          {/* Discount % */}
          <Row
            label="Discount %"
            action={
              <EditBtn
                field="discountPercent"
                current={
                  invoice.discountPercent != null
                    ? (invoice.discountPercent * 100).toString()
                    : ""
                }
              />
            }
          >
            {isEditing("discountPercent") ? (
              <>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className={`${inputCls} font-mono tabnum`}
                    value={editVal}
                    onChange={(e) => setEdit({ field: "discountPercent", value: e.target.value })}
                    autoFocus
                  />
                  <span className="text-[12px] text-ink-muted">%</span>
                </div>
                <CancelSave
                  onSave={() =>
                    save({
                      discountPercent:
                        editVal === "" ? null : parseFloat(editVal) / 100,
                    })
                  }
                />
              </>
            ) : invoice.discountPercent != null ? (
              `${(invoice.discountPercent * 100).toFixed(1)}%`
            ) : (
              "—"
            )}
          </Row>

          {/* Discount Length */}
          <Row
            label="Discount Length (# of payments)"
            action={
              <EditBtn
                field="discountLength"
                current={invoice.discountLength?.toString() ?? ""}
              />
            }
          >
            {isEditing("discountLength") ? (
              <>
                <input
                  type="number"
                  min="0"
                  max="120"
                  className={`${inputCls} font-mono tabnum`}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "discountLength", value: e.target.value })}
                  autoFocus
                />
                <CancelSave
                  onSave={() =>
                    save({ discountLength: editVal === "" ? null : parseInt(editVal, 10) })
                  }
                />
              </>
            ) : (
              invoice.discountLength ?? "—"
            )}
          </Row>

          {/* Fiverr Status */}
          <Row
            label="Fiverr Status"
            action={<EditBtn field="fiverrStatus" current={invoice.fiverrStatus ?? ""} />}
          >
            {isEditing("fiverrStatus") ? (
              <>
                <select
                  className={inputCls}
                  value={editVal}
                  onChange={(e) => setEdit({ field: "fiverrStatus", value: e.target.value })}
                  autoFocus
                >
                  <option value="">—</option>
                  <option value="Gig Pending Acceptance">Gig Pending Acceptance</option>
                  <option value="Gig Accepted">Gig Accepted</option>
                  <option value="Gig Funds Cleared">Gig Funds Cleared</option>
                </select>
                <CancelSave
                  onSave={() =>
                    save({
                      fiverrStatus: (editVal || null) as
                        | "Gig Pending Acceptance"
                        | "Gig Accepted"
                        | "Gig Funds Cleared"
                        | null,
                    })
                  }
                />
              </>
            ) : (
              invoice.fiverrStatus ?? "—"
            )}
          </Row>

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
