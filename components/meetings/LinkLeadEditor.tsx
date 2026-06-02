"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMeetingLead } from "@/lib/mutations/meeting";

type LeadOption = { id: string; label: string };

export function LinkLeadEditor({
  meetingId,
  initialLeadId,
  initialLeadName,
  leads,
}: {
  meetingId: string;
  initialLeadId: string | null;
  initialLeadName: string | null;
  leads: LeadOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialLeadId ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (next: string) => {
    setError(null);
    setValue(next);
    start(async () => {
      const res = await updateMeetingLead(meetingId, next || null);
      if ("error" in res) {
        setError(res.error);
        setValue(initialLeadId ?? "");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="bg-surface border border-rule rounded-card p-4 space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
        Linked lead
      </div>
      <select
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={pending}
        className="w-full bg-bg-elevated border border-rule rounded px-2 py-1.5 text-[13px] text-ink focus:outline-none focus:border-emerald disabled:opacity-50"
      >
        <option value="">— No lead —</option>
        {leads.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      {initialLeadId && initialLeadName && (
        <div className="text-[11px] text-ink-faint">
          Currently: <span className="text-ink-muted">{initialLeadName}</span>
        </div>
      )}
      {error && <div className="text-[11px] text-red">{error}</div>}
    </div>
  );
}
