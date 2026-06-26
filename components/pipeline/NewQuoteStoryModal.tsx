"use client";

import { useEffect, useState, useTransition } from "react";
import { createQuoteStory } from "@/lib/mutations/quote";
import type { QuoteDetail } from "@/lib/quote-types";

type Props = {
  open: boolean;
  quoteId: string;
  onClose: () => void;
  onCreated: (next: QuoteDetail) => void;
  isChangeOrder?: boolean;
  /** When true: hide Cost, show optional Completed Date (drives monthly bucket). */
  isRetainer?: boolean;
};

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-bg-elevated border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none transition-colors placeholder:text-ink-faint";
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5";

export function NewQuoteStoryModal({
  open,
  quoteId,
  onClose,
  onCreated,
  isChangeOrder = false,
  isRetainer = false,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [cost, setCost] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setHours("");
    setCost("");
    setCompletedDate("");
    setClientNotes("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const h = Number(hours);
    if (!name.trim()) return setError("Story Name is required");
    if (!isFinite(h) || h <= 0) return setError("Hours must be positive");

    let c: number | undefined;
    if (!isRetainer) {
      c = Number(cost);
      if (!isFinite(c) || c < 0) return setError("Cost must be 0 or greater");
    }

    startTransition(async () => {
      const res = await createQuoteStory({
        quoteId,
        name: name.trim(),
        description: description.trim() || undefined,
        hours: h,
        cost: c,
        clientNotes: clientNotes.trim() || undefined,
        isChangeOrder,
        completedDate: isRetainer ? completedDate || null : undefined,
      });
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      onCreated(res.quote);
      onClose();
    });
  }

  if (!open) return null;

  const submitDisabled =
    pending || !name.trim() || !hours || (!isRetainer && !cost);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
        onClick={() => !pending && onClose()}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center overflow-y-auto p-4 pointer-events-none">
        <form
          onSubmit={submit}
          className="bg-surface border border-rule rounded-card shadow-2xl w-full max-w-lg my-8 pointer-events-auto"
          role="dialog"
          aria-label="New quote story"
        >
          <div className="flex items-center justify-between border-b border-rule px-5 py-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint flex items-center gap-2">
                {isRetainer ? "Retainer delivery" : "Quote Calculator"}
                {isChangeOrder && (
                  <span className="px-1.5 py-0.5 rounded bg-amber/15 text-amber text-[9px] font-semibold tracking-wider">
                    CHANGE ORDER
                  </span>
                )}
              </div>
              <h2 className="text-[16px] font-semibold text-ink-strong">
                {isChangeOrder
                  ? "Add a change order story"
                  : isRetainer
                    ? "Add a retainer story"
                    : "Add a story"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <label className={labelCls}>Story Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
                placeholder="e.g. Build SSO redirect flow"
                autoFocus
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
                rows={3}
                placeholder="What's involved in this story?"
                className={`${inputCls} resize-y min-h-[60px]`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  disabled={pending}
                  placeholder="e.g. 4"
                  className={inputCls}
                />
              </div>
              {isRetainer ? (
                <div>
                  <label className={labelCls}>
                    Completed Date{" "}
                    <span className="text-ink-faint normal-case tracking-normal">(optional · sets monthly bucket)</span>
                  </label>
                  <input
                    type="date"
                    value={completedDate}
                    onChange={(e) => setCompletedDate(e.target.value)}
                    disabled={pending}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Cost ($)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    disabled={pending}
                    placeholder="e.g. 800"
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>
                Client Notes <span className="text-ink-faint normal-case tracking-normal">(client visible)</span>
              </label>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                disabled={pending}
                rows={2}
                placeholder="What the client will see in the proposal…"
                className={`${inputCls} resize-y min-h-[50px]`}
              />
            </div>

            {error && (
              <div className="bg-red/10 border border-red/30 rounded-md px-3 py-2 text-[12px] text-red">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-rule px-5 py-3 bg-bg-elevated">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="px-4 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Creating…" : "Add Story"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
