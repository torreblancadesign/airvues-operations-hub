"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Meeting } from "@/lib/meetings-types";

function fmtDuration(s: number) {
  if (!s) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const STATUS_STYLES: Record<Meeting["status"], string> = {
  Processing: "bg-amber-300/10 border-amber-300/30 text-amber-300",
  Ready: "bg-emerald/10 border-emerald/30 text-emerald",
  Failed: "bg-red/10 border-red/30 text-red",
};

type Props = { meetings: Meeting[] };

export function MeetingsBrowser({ meetings }: Props) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("any");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return meetings.filter((m) => {
      if (statusFilter !== "any" && m.status !== statusFilter) return false;
      if (needle) {
        const hay = `${m.title} ${m.ownerName ?? ""} ${m.linkedLeadName ?? ""} ${m.summary ?? ""} ${m.keyDecisions ?? ""} ${m.actionItems ?? ""} ${m.questions ?? ""} ${m.transcript ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [meetings, q, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-rule rounded-card p-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, lead, transcript, action items…"
          className="flex-1 min-w-[220px] bg-surface/40 border border-rule rounded-md px-3 py-1.5 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface/40 border border-rule rounded-md px-2 py-1.5 text-[12px] text-ink-strong"
        >
          <option value="any">All statuses</option>
          <option value="Processing">Processing</option>
          <option value="Ready">Ready</option>
          <option value="Failed">Failed</option>
        </select>
        <span className="text-[11px] font-mono text-ink-faint ml-auto">
          {filtered.length} of {meetings.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-rule rounded-card p-8 text-center text-[13px] text-ink-muted">
          No meetings match.
        </div>
      ) : (
        <div className="bg-surface border border-rule rounded-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-elevated text-[11px] font-mono uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Title</th>
                <th className="text-left px-4 py-2 font-medium">Lead</th>
                <th className="text-left px-4 py-2 font-medium">Owner</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="text-right px-4 py-2 font-medium">Duration</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t border-rule-soft hover:bg-bg-elevated/40">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/meetings/${m.id}`}
                      className="text-ink-strong hover:text-emerald font-medium"
                    >
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {m.linkedLeadName ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {m.ownerName ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted font-mono text-[12px]">
                    {new Date(m.createdAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-muted">
                    {fmtDuration(m.durationSec)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${STATUS_STYLES[m.status]}`}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
