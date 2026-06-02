"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateMeetingAnalysis } from "@/lib/mutations/meeting";

export function RegenerateMeetingButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await regenerateMeetingAnalysis(id);
          if ("error" in res) alert(res.error);
          else router.refresh();
        });
      }}
      className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition disabled:opacity-50"
    >
      {pending ? "Regenerating…" : "↻ Regenerate"}
    </button>
  );
}
