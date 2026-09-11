"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, Trash2 } from "lucide-react";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export type DeleteResult = { ok: true } | { error: string } | Record<string, unknown>;

/**
 * The one destructive-action control. Every delete and archive in the app goes
 * through it so the confirmation never depends on who wrote the page.
 *
 * Two-step inline arm → confirm rather than window.confirm(): a native dialog
 * blocks the whole page (and the extension driving it), reads the same for a
 * reversible archive as for a permanent delete, and gives nowhere to show the
 * consequence line — which is the part people actually need to read.
 *
 * Render it only when the viewer may delete; it does not gate itself. The real
 * gate is deleteGate() inside the Server Action (lib/authz.ts).
 */
export function DeleteControl({
  onConfirm,
  onDone,
  label = "Delete",
  question = "Delete permanently?",
  consequence,
  confirmLabel = "Yes, delete",
  variant = "delete",
  className = "",
}: {
  onConfirm: () => Promise<DeleteResult>;
  onDone?: () => void;
  label?: string;
  question?: string;
  /** What this actually does to the data. Shown only once armed. */
  consequence?: string;
  confirmLabel?: string;
  variant?: "delete" | "archive";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = variant === "archive" ? Archive : Trash2;

  // Disarms on its own so a stray click never leaves a live destructive button
  // sitting there for the next person who walks past the screen.
  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  if (!armed) {
    return (
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        {error && (
          <p role="alert" className="text-[11px] text-red max-w-[46ch]">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setArmed(true);
          }}
          className={`inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-red/40 hover:text-red ${FOCUS}`}
        >
          <Icon aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="min-w-0">
        <span className="text-[12px] text-ink-strong">{question}</span>
        {consequence && (
          <p className="text-[11px] text-ink-faint max-w-[52ch]">{consequence}</p>
        )}
      </div>
      <button
        type="button"
        autoFocus
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await onConfirm();
            if (res && typeof res === "object" && "error" in res) {
              setError(String(res.error));
              setArmed(false);
              return;
            }
            setArmed(false);
            onDone?.();
          })
        }
        className={`inline-flex items-center gap-1.5 rounded-md border border-red/40 bg-red/15 px-3 py-1.5 text-[12px] font-medium text-red transition-colors hover:bg-red/25 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
      >
        <Icon aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
        {pending ? "Working…" : confirmLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setArmed(false)}
        className="rounded px-2 py-1.5 text-[12px] text-ink-faint transition-colors hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
