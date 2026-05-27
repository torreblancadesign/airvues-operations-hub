"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createInvoice } from "@/lib/mutations/invoice";
import type { PayerOption } from "@/lib/people-light";
import type { QuoteOption } from "@/lib/quotes-light";

type Props = {
  open: boolean;
  onClose: () => void;
  payers: PayerOption[];
  quotes: QuoteOption[];
};

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-bg border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors";

const labelCls =
  "block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5";

export function NewInvoiceModal({ open, onClose, payers, quotes }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [payerId, setPayerId] = useState("");
  const [payerSearch, setPayerSearch] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"One-time" | "Recurring" | "Payment Plan">("One-time");
  const [source, setSource] = useState<"Stripe" | "Fiverr" | "Other">("Stripe");
  const [description, setDescription] = useState("");
  const [needsClientApproval, setNeedsClientApproval] = useState<"" | "Yes" | "No">("");
  const [planCount, setPlanCount] = useState("");
  const [planFrequency, setPlanFrequency] = useState<"" | "weekly" | "biweekly" | "monthly">("");
  const [discountPct, setDiscountPct] = useState(""); // user enters 0-100
  const [discountLength, setDiscountLength] = useState("");
  const [fiverrStatus, setFiverrStatus] = useState<
    "" | "Gig Pending Acceptance" | "Gig Accepted" | "Gig Funds Cleared"
  >("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setPayerId("");
      setPayerSearch("");
      setQuoteId("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setType("One-time");
      setSource("Stripe");
      setDescription("");
      setNeedsClientApproval("");
      setPlanCount("");
      setPlanFrequency("");
      setDiscountPct("");
      setDiscountLength("");
      setFiverrStatus("");
      setError(null);
    }
  }, [open]);


  const filteredPayers = useMemo(() => {
    const q = payerSearch.trim().toLowerCase();
    if (!q) return payers.slice(0, 30);
    return payers
      .filter((p) => p.label.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      .slice(0, 30);
  }, [payers, payerSearch]);

  const selectedPayer = payers.find((p) => p.id === payerId) ?? null;

  if (!open) return null;

  const submit = () => {
    setError(null);
    const amt = parseFloat(amount);
    if (!payerId) return setError("Pick a payer");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter a valid amount");

    const planEnabled = type === "Payment Plan" || type === "Recurring";
    const fiverrEnabled = source === "Fiverr";
    const pctNum = discountPct === "" ? null : parseFloat(discountPct);
    if (pctNum != null && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100))
      return setError("Discount % must be 0–100");

    startTransition(async () => {
      const res = await createInvoice({
        payerId,
        quoteId: quoteId || null,
        amount: amt,
        date,
        type,
        source,
        description: description.trim() || null,
        needsClientApproval: needsClientApproval || null,
        paymentPlanCount:
          planEnabled && planCount !== "" ? parseInt(planCount, 10) : null,
        paymentPlanFrequency: planEnabled ? planFrequency || null : null,
        discountPercent: pctNum != null ? pctNum / 100 : null,
        discountLength: discountLength !== "" ? parseInt(discountLength, 10) : null,
        fiverrStatus: fiverrEnabled ? fiverrStatus || null : null,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  };


  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pointer-events-none"
        role="dialog"
        aria-label="New invoice"
      >
        <div className="w-full max-w-[560px] bg-surface border border-rule rounded-card shadow-2xl pointer-events-auto max-h-[88vh] overflow-y-auto">
          <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between z-10">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">New invoice</div>
              <h2 className="text-[16px] font-semibold text-ink-strong">Create Airtable record</h2>
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

          <div className="p-5 space-y-4">
            {/* Payer picker */}
            <div>
              <label className={labelCls}>Payer *</label>
              {selectedPayer ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-bg border border-emerald/30 rounded-md">
                  <div className="min-w-0">
                    <div className="text-[13px] text-ink-strong truncate">{selectedPayer.label}</div>
                    {selectedPayer.email && (
                      <div className="text-[11px] text-ink-muted font-mono truncate">{selectedPayer.email}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPayerId("");
                      setPayerSearch("");
                    }}
                    className="text-[11px] text-ink-muted hover:text-ink-strong shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={payerSearch}
                    onChange={(e) => setPayerSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className={inputCls}
                    autoFocus
                  />
                  <div className="mt-1.5 max-h-44 overflow-y-auto border border-rule rounded-md bg-bg">
                    {filteredPayers.length === 0 ? (
                      <div className="px-3 py-2 text-[12px] text-ink-faint">No matches</div>
                    ) : (
                      filteredPayers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPayerId(p.id)}
                          className="w-full text-left px-3 py-1.5 hover:bg-bg-elevated border-b border-rule-soft last:border-0"
                        >
                          <div className="text-[12px] text-ink-strong">{p.label}</div>
                          {p.email && (
                            <div className="text-[10px] text-ink-muted font-mono">{p.email}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Quote picker */}
            <div>
              <label className={labelCls}>Linked quote (optional)</label>
              <select
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
                className={inputCls}
              >
                <option value="">— None —</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`${inputCls} font-mono tabnum`}
                />
              </div>
              <div>
                <label className={labelCls}>Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>

            {/* Type + Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className={inputCls}
                >
                  <option value="One-time">One-time</option>
                  <option value="Recurring">Recurring</option>
                  <option value="Payment Plan">Payment Plan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Source *</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof source)}
                  className={inputCls}
                >
                  <option value="Stripe">Stripe</option>
                  <option value="Fiverr">Fiverr</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="What is this invoice for?"
                className={`${inputCls} resize-y`}
              />
            </div>

            {/* Need Client Approval (subscriptions) */}
            {type !== "One-time" && (
              <div>
                <label className={labelCls}>Need client approval for subscription payment?</label>
                <select
                  value={needsClientApproval}
                  onChange={(e) => setNeedsClientApproval(e.target.value as "" | "Yes" | "No")}
                  className={inputCls}
                >
                  <option value="">—</option>
                  <option value="Yes">Yes — client approves first invoice</option>
                  <option value="No">No — charge immediately</option>
                </select>
              </div>
            )}

            {/* Payment plan */}
            {(type === "Payment Plan" || type === "Recurring") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Payment plan — # of payments</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={planCount}
                    onChange={(e) => setPlanCount(e.target.value)}
                    placeholder="e.g. 4"
                    className={`${inputCls} font-mono tabnum`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Payment plan — frequency</label>
                  <select
                    value={planFrequency}
                    onChange={(e) =>
                      setPlanFrequency(e.target.value as "" | "weekly" | "biweekly" | "monthly")
                    }
                    className={inputCls}
                  >
                    <option value="">—</option>
                    <option value="weekly">weekly</option>
                    <option value="biweekly">biweekly</option>
                    <option value="monthly">monthly</option>
                  </select>
                </div>
              </div>
            )}

            {/* Discount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="0"
                  className={`${inputCls} font-mono tabnum`}
                />
              </div>
              <div>
                <label className={labelCls}>Discount length (# of payments)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={discountLength}
                  onChange={(e) => setDiscountLength(e.target.value)}
                  placeholder="0"
                  className={`${inputCls} font-mono tabnum`}
                />
              </div>
            </div>

            {/* Fiverr status */}
            {source === "Fiverr" && (
              <div>
                <label className={labelCls}>Fiverr status</label>
                <select
                  value={fiverrStatus}
                  onChange={(e) =>
                    setFiverrStatus(
                      e.target.value as
                        | ""
                        | "Gig Pending Acceptance"
                        | "Gig Accepted"
                        | "Gig Funds Cleared",
                    )
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  <option value="Gig Pending Acceptance">Gig Pending Acceptance</option>
                  <option value="Gig Accepted">Gig Accepted</option>
                  <option value="Gig Funds Cleared">Gig Funds Cleared</option>
                </select>
              </div>
            )}



            <div className="text-[11px] text-ink-faint border border-rule rounded-md bg-bg-elevated px-3 py-2">
              Status will be set to <span className="font-mono text-ink-muted">unsent</span>. Use
              the <span className="text-ink-strong">Send invoice</span> button on the invoice row
              when you&apos;re ready to fire the Airtable automation.
            </div>

            {error && (
              <div className="text-[12px] text-red bg-red/10 border border-red/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-surface border-t border-rule px-5 py-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong border border-rule rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-4 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded-md hover:bg-emerald/80 disabled:opacity-50 transition-colors"
            >
              {pending ? "Creating…" : "Create invoice"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
