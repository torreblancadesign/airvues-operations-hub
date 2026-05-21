"use client";

import { useEffect } from "react";
import { Lead } from "@/lib/leads";
import { STATUS_PILL } from "./types";

type Props = {
  lead: Lead | null;
  onClose: () => void;
};

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-rule last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">{label}</div>
      <div className="text-[13px] text-ink whitespace-pre-wrap">{children}</div>
    </div>
  );
}

export function LeadSheet({ lead, onClose }: Props) {
  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  if (!lead) return null;

  const now = Date.now();
  const meetMs = lead.meetingDate ? new Date(lead.meetingDate).getTime() : null;
  const endMs = lead.endMeetingDate ? new Date(lead.endMeetingDate).getTime() : (meetMs ? meetMs + 30 * 60_000 : null);
  const isJoinable =
    !!lead.meetingLink && meetMs != null && endMs != null && now >= meetMs - 15 * 60_000 && now <= endMs + 5 * 60_000;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[520px] bg-surface z-50 border-l border-rule shadow-xl overflow-y-auto" role="dialog">
        <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">Lead</div>
            <h2 className="text-[16px] font-semibold text-ink-strong leading-tight max-w-[400px]">{lead.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated" aria-label="Close">×</button>
        </div>

        <div className="px-5 py-5 bg-bg-elevated border-b border-rule">
          <div className="text-[20px] font-semibold text-ink-strong leading-tight">{lead.company ?? "—"}</div>
          <div className="mt-1 text-[12px] text-ink-muted">{lead.title ?? "—"}</div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {lead.status && (
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${STATUS_PILL[lead.status]}`}>
                {lead.status}
              </span>
            )}
            {lead.budget && (
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-violet-soft text-violet">{lead.budget}</span>
            )}
            {lead.source && (
              <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-rule text-ink-muted">{lead.source}</span>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-rule flex gap-2 flex-wrap">
          {lead.meetingLink && (
            <a
              href={lead.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
                isJoinable
                  ? "bg-emerald text-bg hover:bg-emerald/80"
                  : "bg-bg-elevated border border-rule text-ink hover:border-ink-muted"
              }`}
            >
              {isJoinable ? "Join Meet now ↗" : "Meet link ↗"}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">Email ↗</a>
          )}
          <a href={lead.airtableUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">Airtable ↗</a>
        </div>

        <div className="px-5 py-2">
          <Field label="Email">{lead.email ?? "—"}</Field>
          <Field label="Meeting">{fmtDateTime(lead.meetingDate)}</Field>
          <Field label="Created">{fmtDateTime(lead.createdTime)}</Field>
          <Field label="Assessor">{lead.assessor ?? "—"}</Field>
          <Field label="What they want to build">{lead.whatToBuild ?? "—"}</Field>
          {lead.clientIntro && <Field label="Client introduction (AI)">{lead.clientIntro}</Field>}
          {lead.quotesCount > 0 && (
            <Field label={`Linked quotes (${lead.quotesCount})`}>
              {lead.quoteStatuses.length > 0 ? lead.quoteStatuses.join(" · ") : "—"}
            </Field>
          )}
          {lead.transcript && <Field label="Meeting transcript">{lead.transcript}</Field>}
          <Field label="Airtable Record ID"><span className="font-mono text-[12px]">{lead.id}</span></Field>
        </div>
      </aside>
    </>
  );
}
