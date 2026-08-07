"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteLoop } from "@/lib/mutations/loop";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function DeleteLoopButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Two-step inline confirm rather than a blocking window.confirm(). Disarms on
  // its own so a stray click never leaves a live delete button sitting there.
  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 6000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  if (!armed) {
    return (
      <div className="flex items-center gap-3">
        {error && (
          <p role="alert" className="text-[11px] text-red">
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
          <Trash2 aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-ink-muted">Delete permanently?</span>
      <button
        type="button"
        autoFocus
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteLoop(id);
            if ("error" in res) {
              setError(res.error);
              setArmed(false);
            } else {
              router.push("/loops");
              router.refresh();
            }
          })
        }
        className={`inline-flex items-center gap-1.5 rounded-md border border-red/40 bg-red/15 px-3 py-1.5 text-[12px] font-medium text-red transition-colors hover:bg-red/25 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
      >
        <Trash2 aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
        {pending ? "Deleting…" : "Yes, delete"}
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
