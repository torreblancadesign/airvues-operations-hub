"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStory } from "@/lib/mutations/story";

type EngineerOption = { id: string; name: string };
type QuoteOption = { id: string; label: string; totalCost: number; status: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  engineers: EngineerOption[];
  quotes: QuoteOption[];
};

const PRIORITY_OPTIONS = ["Urgent", "High", "Medium", "Low"];

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-bg-elevated border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none transition-colors placeholder:text-ink-faint";
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function NewStoryModal({ open, onClose, engineers, quotes }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const [invoice, setInvoice] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset when opening fresh
  useEffect(() => {
    if (!open) return;
    setName("");
    setHours("");
    setInvoice("");
    setPriority("Medium");
    setAssigneeIds([]);
    setQuoteId("");
    setDescription("");
    setError(null);
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const h = Number(hours);
    const inv = Number(invoice);
    if (!name.trim()) {
      setError("Story Name is required");
      return;
    }
    if (!isFinite(h) || h <= 0) {
      setError("Hours must be a positive number");
      return;
    }
    if (!isFinite(inv) || inv < 0) {
      setError("Invoice value must be 0 or greater");
      return;
    }

    startTransition(async () => {
      const result = await createStory({
        name: name.trim(),
        hours: h,
        invoice: inv,
        priority,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
        quoteIds: quoteId ? [quoteId] : undefined,
        description: description.trim() || undefined,
      });
      if (!("ok" in result)) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  if (!open) return null;

  const selectedQuote = quoteId ? quotes.find((q) => q.id === quoteId) : null;
  const commission = isFinite(Number(invoice)) ? Number(invoice) * 0.15 : 0;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={() => !pending && onClose()}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 pointer-events-none">
        <form
          onSubmit={submit}
          className="bg-surface border border-rule rounded-card shadow-2xl w-full max-w-lg my-8 pointer-events-auto"
          role="dialog"
          aria-label="New story"
        >
          <div className="flex items-center justify-between border-b border-rule px-5 py-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                New Story
              </div>
              <h2 className="text-[16px] font-semibold text-ink-strong">
                Create a story
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
              <label className={labelCls} htmlFor="story-name">Story Name</label>
              <input
                id="story-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
                placeholder="What needs to ship?"
                autoFocus
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="story-hours">Hours scoped</label>
                <input
                  id="story-hours"
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
              <div>
                <label className={labelCls} htmlFor="story-invoice">Invoice value ($)</label>
                <input
                  id="story-invoice"
                  type="number"
                  step="1"
                  min="0"
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  disabled={pending}
                  placeholder="e.g. 800"
                  className={inputCls}
                />
                {commission > 0 && (
                  <div className="mt-1 text-[10px] text-emerald font-mono">
                    Commission @ 15% = {fmtMoney(commission)}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="story-priority">Priority</label>
              <select
                id="story-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={pending}
                className={`${inputCls} cursor-pointer`}
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Assignees (optional)</label>
              <div className="flex flex-wrap gap-1">
                {engineers.map((e) => {
                  const selected = assigneeIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleAssignee(e.id)}
                      disabled={pending}
                      className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                        selected
                          ? "bg-emerald/15 border-emerald text-emerald"
                          : "bg-bg-elevated border-rule text-ink-muted hover:border-ink-muted hover:text-ink-strong"
                      }`}
                    >
                      {selected ? "✓ " : ""}{e.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="story-quote">Quote (optional)</label>
              <select
                id="story-quote"
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
                disabled={pending}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">— no quote linked —</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}{q.status ? ` · ${q.status}` : ""} · {fmtMoney(q.totalCost)}
                  </option>
                ))}
              </select>
              {selectedQuote && (
                <div className="mt-1 text-[10px] text-ink-faint font-mono">
                  Story value typically a fraction of {fmtMoney(selectedQuote.totalCost)} quote total.
                </div>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="story-description">Description (optional)</label>
              <textarea
                id="story-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
                rows={3}
                placeholder="Context, acceptance criteria, links..."
                className={`${inputCls} resize-y min-h-[60px]`}
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
              disabled={pending || !name.trim() || !hours || !invoice}
              className="px-4 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Creating…" : "Create Story"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
