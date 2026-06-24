"use client";

import { useState, useTransition } from "react";
import { updateQuoteDealStage } from "@/lib/mutations/quote";

const STAGES = [
  "Draft",
  "Sent. Awaiting Approval.",
  "Approved and Signed",
  "Awaiting Payment",
  "Project In Progress",
  "Paid",
  "Cancelled",
  "Rejected",
  "Auditing 🚩",
] as const;

export function DealStageChip({
  quoteId,
  initialStatus,
  canEdit,
}: {
  quoteId: string;
  initialStatus: string | null;
  canEdit: boolean;
}) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleChange(next: string) {
    const prev = status;
    setStatus(next);
    setErr(null);
    startTransition(async () => {
      const res = await updateQuoteDealStage(quoteId, next);
      if ("error" in res) {
        setErr(res.error);
        setStatus(prev);
      }
    });
  }

  if (!canEdit) {
    return (
      <span className="px-2.5 py-1 bg-bg-elevated border border-rule rounded font-mono text-ink text-[12px]">
        <span className="text-ink-faint mr-1">Deal:</span>
        {status ?? "—"}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center bg-bg-elevated border border-rule rounded text-[12px] font-mono"
      title={err ?? "Click to change Deal Stage"}
    >
      <span className="pl-2.5 text-ink-faint">Deal:</span>
      <select
        value={status ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="bg-transparent text-ink py-1 px-1.5 focus:outline-none cursor-pointer disabled:opacity-50"
      >
        {!status && <option value="">—</option>}
        {STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {err && <span className="pr-2 text-red text-[10px]">⚠</span>}
    </span>
  );
}
