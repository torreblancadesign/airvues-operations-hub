"use client";

import { Lead, LeadStatus } from "@/lib/leads";
import { STATUS_ORDER } from "./types";

type Props = {
  leads: Lead[];
  onSelectStatus: (s: LeadStatus) => void;
};

const COLORS: Record<LeadStatus, string> = {
  "New Lead": "bg-sky",
  "Needs Review": "bg-ink-muted",
  "In Proposal Stage": "bg-amber",
  "Sold": "bg-emerald",
  "Not Sold": "bg-red/70",
};

export function StatusFunnel({ leads, onSelectStatus }: Props) {
  const counts: Record<LeadStatus, number> = {
    "New Lead": 0, "Needs Review": 0, "In Proposal Stage": 0, "Sold": 0, "Not Sold": 0,
  };
  for (const l of leads) {
    if (l.status) counts[l.status] += 1;
  }
  const max = Math.max(1, ...STATUS_ORDER.map((s) => counts[s]));

  return (
    <div className="bg-surface rounded-card border border-rule p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="eyebrow">Status funnel</h3>
        <div className="text-[11px] text-ink-faint">Click a bar to filter</div>
      </div>
      <div className="space-y-2">
        {STATUS_ORDER.map((s) => {
          const widthPct = (counts[s] / max) * 100;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSelectStatus(s)}
              className="grid grid-cols-[130px_1fr_44px] items-center gap-3 w-full text-left hover:bg-bg-elevated rounded-sm px-1 py-0.5 transition-colors"
            >
              <span className="text-[12px] text-ink truncate">{s}</span>
              <div className="h-5 bg-bg rounded-sm overflow-hidden">
                <div className={`h-full ${COLORS[s]}`} style={{ width: `${widthPct}%` }} />
              </div>
              <span className="text-[12px] text-ink-strong font-semibold tabnum text-right font-mono">{counts[s]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
