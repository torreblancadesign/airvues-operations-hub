"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSprint } from "@/lib/mutations/sprint";

type Props = {
  open: boolean;
  onClose: () => void;
  suggestedNumber: number;
};

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-bg-elevated border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none transition-colors placeholder:text-ink-faint";
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5";

// Default Sprint Start = next Monday (sprints typically start Monday)
function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

export function NewSprintModal({ open, onClose, suggestedNumber }: Props) {
  const router = useRouter();
  const [number, setNumber] = useState(String(suggestedNumber));
  const [status, setStatus] = useState<"Next" | "In Progress" | "Done">("Next");
  const [start, setStart] = useState(nextMonday());
  const [goal, setGoal] = useState("");
  const [goalsLong, setGoalsLong] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNumber(String(suggestedNumber));
    setStatus("Next");
    setStart(nextMonday());
    setGoal("");
    setGoalsLong("");
    setError(null);
  }, [open, suggestedNumber]);

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
    const n = Number(number);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Sprint Number must be a positive integer");
      return;
    }
    if (!start) {
      setError("Sprint Start is required");
      return;
    }

    startTransition(async () => {
      const result = await createSprint({
        number: n,
        status,
        start,
        goal: goal.trim() || undefined,
        goals: goalsLong.trim() || undefined,
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
          className="bg-surface border border-rule rounded-card shadow-2xl w-full max-w-md my-8 pointer-events-auto"
          role="dialog"
          aria-label="New sprint"
        >
          <div className="flex items-center justify-between border-b border-rule px-5 py-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                New Sprint
              </div>
              <h2 className="text-[16px] font-semibold text-ink-strong">Start a sprint</h2>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="sprint-number">Sprint Number</label>
                <input
                  id="sprint-number"
                  type="number"
                  step="1"
                  min="1"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  disabled={pending}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="sprint-status">Status</label>
                <select
                  id="sprint-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  disabled={pending}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="Next">Next (planned)</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="sprint-start">Sprint Start</label>
              <input
                id="sprint-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={pending}
                className={`${inputCls} font-mono`}
              />
              <div className="mt-1 text-[10px] text-ink-faint font-mono">
                Sprint End is auto-computed (formula in Airtable)
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="sprint-goal">Sprint Goal (short)</label>
              <input
                id="sprint-goal"
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                disabled={pending}
                placeholder="e.g. Ship Gracie Barra v2.8 + close Dr. Bronner's intake"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="sprint-goals">Goals (long form, optional)</label>
              <textarea
                id="sprint-goals"
                value={goalsLong}
                onChange={(e) => setGoalsLong(e.target.value)}
                disabled={pending}
                rows={3}
                placeholder="Specific objectives, success criteria, focus areas..."
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
              disabled={pending || !number || !start}
              className="px-4 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Creating…" : "Create Sprint"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
