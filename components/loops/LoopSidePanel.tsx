"use client";

// The rail beside the player on /loops/[id]: AI summary and full transcript as
// tabs, so the video keeps the page and the reading material stays alongside it.
//
// Deliberately does NOT reuse AiSummaryPanel — that renders bordered cards, which
// would nest inside this panel. Here the sections are rule-separated blocks.
import { useRef, useState } from "react";
import { Check, Copy, FileText, Sparkles, TriangleAlert } from "lucide-react";
import type { LoopAnalysisState } from "@/lib/loops-types";

type TabId = "summary" | "transcript";

const TABS: { id: TabId; label: string; icon: typeof Sparkles }[] = [
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "transcript", label: "Transcript", icon: FileText },
];

type Props = {
  summary: string | null;
  keyNotes: string | null;
  actionItems: string | null;
  questions: string | null;
  transcript: string | null;
  state: LoopAnalysisState;
  canRegenerate: boolean;
  /** RegenerateAnalysisButton, rendered in the footer where both tabs can reach it. */
  regenerateSlot?: React.ReactNode;
};

function has(s: string | null): s is string {
  return !!s && s.trim().length > 0;
}

function Block({
  label,
  accent,
  children,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule-soft px-4 py-4 last:border-b-0">
      <h3 className={`font-mono text-[10px] uppercase tracking-[0.16em] ${accent}`}>{label}</h3>
      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{children}</p>
    </section>
  );
}

function EmptyPanel({
  state,
  canRegenerate,
  what,
}: {
  state: LoopAnalysisState;
  canRegenerate: boolean;
  what: string;
}) {
  if (state === "failed") {
    return (
      <div className="flex gap-3 px-4 py-6">
        <TriangleAlert
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-px h-4 w-4 shrink-0 text-amber"
        />
        <p className="text-[13px] leading-relaxed text-ink-muted">
          <span className="text-ink-strong">Analysis didn&apos;t finish.</span> The recording plays
          fine — only the {what} is missing.{" "}
          {canRegenerate
            ? "Regenerate below to try again."
            : "Ask the owner or an admin to regenerate it."}
        </p>
      </div>
    );
  }
  return (
    <p className="px-4 py-6 text-[13px] leading-relaxed text-ink-muted">
      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald/60 align-middle motion-safe:animate-pulse" />
      Generating the {what}… refresh in a moment.
    </p>
  );
}

export function LoopSidePanel({
  summary,
  keyNotes,
  actionItems,
  questions,
  transcript,
  state,
  canRegenerate,
  regenerateSlot,
}: Props) {
  const [tab, setTab] = useState<TabId>("summary");
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const hasSummary = has(summary) || has(keyNotes) || has(actionItems) || has(questions);

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const copyTranscript = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is selectable in the panel */
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-rule bg-surface lg:sticky lg:top-14 lg:max-h-[calc(100dvh-4.5rem)]">
      <div
        role="tablist"
        aria-label="Recording details"
        onKeyDown={onTabKeyDown}
        className="flex shrink-0 items-center gap-1 border-b border-rule px-2"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`loop-tab-${id}`}
              aria-selected={active}
              aria-controls={`loop-panel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald/70 ${
                active
                  ? "border-emerald text-emerald"
                  : "border-transparent text-ink-faint hover:text-ink-strong"
              }`}
            >
              <Icon aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}

        {tab === "transcript" && has(transcript) && (
          <button
            type="button"
            onClick={copyTranscript}
            className={`ml-auto inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 ${
              copied ? "text-emerald" : "text-ink-faint hover:text-emerald"
            }`}
          >
            {copied ? (
              <Check aria-hidden="true" strokeWidth={2} className="h-3 w-3" />
            ) : (
              <Copy aria-hidden="true" strokeWidth={1.75} className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          role="tabpanel"
          id="loop-panel-summary"
          aria-labelledby="loop-tab-summary"
          hidden={tab !== "summary"}
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald/40"
        >
          {hasSummary ? (
            <>
              {has(summary) && (
                <Block label="Summary" accent="text-ink-faint">
                  {summary}
                </Block>
              )}
              {has(keyNotes) && (
                <Block label="Key notes" accent="text-emerald/80">
                  {keyNotes}
                </Block>
              )}
              {has(actionItems) && (
                <Block label="Action items" accent="text-sky/80">
                  {actionItems}
                </Block>
              )}
              {has(questions) && (
                <Block label="Questions for client" accent="text-amber/80">
                  {questions}
                </Block>
              )}
            </>
          ) : (
            <EmptyPanel state={state} canRegenerate={canRegenerate} what="summary" />
          )}
        </div>

        <div
          role="tabpanel"
          id="loop-panel-transcript"
          aria-labelledby="loop-tab-transcript"
          hidden={tab !== "transcript"}
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald/40"
        >
          {has(transcript) ? (
            <p className="whitespace-pre-wrap px-4 py-4 font-mono text-[12px] leading-relaxed text-ink-muted">
              {transcript}
            </p>
          ) : (
            <EmptyPanel state={state} canRegenerate={canRegenerate} what="transcript" />
          )}
        </div>
      </div>

      {regenerateSlot && (
        <div className="shrink-0 border-t border-rule px-3 py-2.5">{regenerateSlot}</div>
      )}
    </div>
  );
}
