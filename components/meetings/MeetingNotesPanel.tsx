// AI-generated meeting notes cards. Shown on /meetings/[id] and in lead drawer.
import type { ReactNode } from "react";
import type { MeetingStatus } from "@/lib/meetings-types";

type Props = {
  status: MeetingStatus;
  summary: string | null;
  keyDecisions: string | null;
  actionItems: string | null;
  questions: string | null;
};

function hasContent(s: string | null): s is string {
  return !!s && s.trim().length > 0;
}

function Card({ label, children, accent }: { label: string; children: ReactNode; accent?: string }) {
  return (
    <div className="bg-surface border border-rule rounded-card p-4 space-y-2">
      <div
        className={`text-[11px] font-mono uppercase tracking-wider ${accent ?? "text-ink-faint"}`}
      >
        {label}
      </div>
      <div className="text-[13.5px] leading-relaxed text-ink-strong whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

export function MeetingNotesPanel({
  status,
  summary,
  keyDecisions,
  actionItems,
  questions,
}: Props) {
  const anyContent =
    hasContent(summary) || hasContent(keyDecisions) || hasContent(actionItems) || hasContent(questions);

  if (!anyContent) {
    if (status === "Failed") {
      return (
        <div className="bg-surface border border-red/30 rounded-card p-4 text-[13px] text-red">
          AI analysis failed. Click <span className="font-mono">↻ Regenerate</span> to retry.
        </div>
      );
    }
    return (
      <div className="bg-surface border border-rule/60 border-dashed rounded-card p-4 text-[13px] text-ink-muted">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald/60 animate-pulse mr-2 align-middle" />
        Transcribing the call and writing notes… refresh in a moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasContent(summary) && <Card label="Summary">{summary}</Card>}
      {hasContent(keyDecisions) && (
        <Card label="Key decisions" accent="text-emerald/80">
          {keyDecisions}
        </Card>
      )}
      {hasContent(actionItems) && (
        <Card label="Action items" accent="text-sky-300/80">
          {actionItems}
        </Card>
      )}
      {hasContent(questions) && (
        <Card label="Follow-up questions for client" accent="text-amber-300/80">
          {questions}
        </Card>
      )}
    </div>
  );
}
