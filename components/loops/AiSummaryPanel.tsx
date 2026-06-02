// AI-generated client-facing summary cards. Shown on /loops/[id] and /r/[token].
import type { ReactNode } from "react";

type Props = {
  summary: string | null;
  keyNotes: string | null;
  actionItems: string | null;
  questions: string | null;
  variant?: "internal" | "public";
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

export function AiSummaryPanel({
  summary,
  keyNotes,
  actionItems,
  questions,
  variant = "internal",
}: Props) {
  const anyContent =
    hasContent(summary) || hasContent(keyNotes) || hasContent(actionItems) || hasContent(questions);

  if (!anyContent) {
    if (variant === "public") return null;
    return (
      <div className="bg-surface border border-rule/60 border-dashed rounded-card p-4 text-[13px] text-ink-muted">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald/60 animate-pulse mr-2 align-middle" />
        Generating summary, key notes, and action items… refresh in a moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasContent(summary) && <Card label="Summary">{summary}</Card>}
      {hasContent(keyNotes) && (
        <Card label="Key notes" accent="text-emerald/80">
          {keyNotes}
        </Card>
      )}
      {hasContent(actionItems) && (
        <Card label="Action items" accent="text-sky-300/80">
          {actionItems}
        </Card>
      )}
      {hasContent(questions) && (
        <Card label="Questions for client" accent="text-amber-300/80">
          {questions}
        </Card>
      )}
    </div>
  );
}
