"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { regenerateLoopAnalysis } from "@/lib/mutations/loop";

export function RegenerateAnalysisButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {error && (
        <p role="alert" className="truncate text-[11px] text-red">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await regenerateLoopAnalysis(id);
            if ("error" in res) setError(res.error);
            else router.refresh();
          });
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rule bg-surface px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-muted transition-colors hover:border-emerald/40 hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw
          aria-hidden="true"
          strokeWidth={1.75}
          className={`h-3 w-3 ${pending ? "motion-safe:animate-spin" : ""}`}
        />
        {pending ? "Regenerating…" : "Regenerate"}
      </button>
    </div>
  );
}
