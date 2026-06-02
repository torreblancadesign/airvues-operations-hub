"use client";

import { useEffect, useState } from "react";
import { Lead } from "@/lib/leads";
import { STATUS_PILL } from "./types";
import { JoinAndRecordButton } from "@/components/meetings/JoinAndRecordButton";

type Props = {
  leads: Lead[];
  onSelect: (l: Lead) => void;
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function UpcomingMeetings({ leads, onSelect }: Props) {
  // Re-tick every 60s so the Join button activates/deactivates as time advances.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const horizon = now + 14 * 86_400_000;
  const upcoming = leads
    .filter((l) => {
      if (!l.meetingDate) return false;
      const m = new Date(l.meetingDate).getTime();
      const end = l.endMeetingDate ? new Date(l.endMeetingDate).getTime() : m + 30 * 60_000;
      return end >= now && m <= horizon;
    })
    .sort((a, b) => new Date(a.meetingDate!).getTime() - new Date(b.meetingDate!).getTime());

  // Group by day
  const groups = new Map<string, Lead[]>();
  for (const l of upcoming) {
    const key = dayKey(new Date(l.meetingDate!));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <div className="bg-surface rounded-card border border-rule p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="eyebrow">Upcoming intro meetings</h3>
          <div className="text-[11px] text-ink-faint mt-0.5">Next 14 days · live</div>
        </div>
        <div className="text-[12px] text-ink-muted tabnum font-mono">
          <span className="text-ink-strong">{upcoming.length}</span> scheduled
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="text-[13px] text-ink-muted py-6 text-center">
          No upcoming intros — schedule one in Airtable.
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([key, items]) => (
            <div key={key}>
              <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted mb-2 pb-1 border-b border-rule-soft">
                {dayLabel(key)} · {items.length}
              </div>
              <ol className="relative space-y-2 pl-4 border-l border-rule">
                {items.map((l) => {
                  const m = new Date(l.meetingDate!).getTime();
                  const end = l.endMeetingDate ? new Date(l.endMeetingDate).getTime() : m + 30 * 60_000;
                  const isJoinable = !!l.meetingLink && now >= m - 15 * 60_000 && now <= end + 5 * 60_000;
                  const isLive = now >= m && now <= end;
                  return (
                    <li key={l.id} className="relative">
                      <span className={`absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full border-2 ${
                        isLive ? "bg-emerald border-emerald animate-pulse"
                          : isJoinable ? "bg-amber border-amber"
                          : "bg-bg border-rule"
                      }`} />
                      <div className="bg-bg-elevated border border-rule rounded-md p-3 hover:border-ink-muted transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[12px] font-mono tabnum text-ink-strong">{fmtTime(l.meetingDate!)}</span>
                              {isLive && <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald">● Live</span>}
                              {l.status && (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider ${STATUS_PILL[l.status]}`}>
                                  {l.status}
                                </span>
                              )}
                              {l.budget && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono bg-violet-soft text-violet">{l.budget}</span>
                              )}
                              {l.source && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] text-ink-faint border border-rule">{l.source}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelect(l)}
                              className="mt-1 text-left text-[13px] text-ink-strong font-medium hover:text-emerald transition-colors"
                            >
                              {l.name} {l.company ? <span className="text-ink-muted font-normal">· {l.company}</span> : null}
                            </button>
                            {l.whatToBuild && (
                              <div className="mt-1 text-[11px] text-ink-muted line-clamp-2">{l.whatToBuild}</div>
                            )}
                          </div>
                          {l.meetingLink && (
                            <JoinAndRecordButton
                              meetingUrl={l.meetingLink}
                              leadId={l.id}
                              isJoinable={isJoinable}
                              label={isJoinable ? "Join + record ↗" : "Meet ↗"}
                              className={`shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors ${
                                isJoinable
                                  ? "bg-emerald text-bg hover:bg-emerald/80"
                                  : "bg-surface border border-rule text-ink-muted hover:text-ink hover:border-ink-muted"
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
