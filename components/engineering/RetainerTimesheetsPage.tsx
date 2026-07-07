"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QuoteStoriesTable } from "@/components/pipeline/QuoteStoriesTable";
import { NewQuoteStoryModal } from "@/components/pipeline/NewQuoteStoryModal";
import type { PersonOption, QuoteDetail } from "@/lib/quote-types";
import type { RetainerListItem } from "@/lib/retainer-timesheets";

type Props = {
  retainers: RetainerListItem[];
  selectedId: string | null;
  selectedQuote: QuoteDetail | null;
  people: PersonOption[];
  canEdit: boolean;
};

const chipCls =
  "inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider";

function stageTone(s: string | null): string {
  if (!s) return "bg-bg-elevated text-ink-muted";
  if (s === "Paid" || s === "Project In Progress" || s === "Approved and Signed")
    return "bg-emerald/15 text-emerald";
  if (s === "Awaiting Payment" || s === "Sent. Awaiting Approval.")
    return "bg-sky/15 text-sky";
  if (s === "Rejected" || s === "Cancelled") return "bg-red/15 text-red";
  return "bg-bg-elevated text-ink-muted";
}

export function RetainerTimesheetsPage({
  retainers,
  selectedId,
  selectedQuote: selectedQuoteProp,
  people,
  canEdit,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [showAddStory, setShowAddStory] = useState(false);
  const [, startTransition] = useTransition();

  // Keep a local copy of the selected quote so inline edits + add-story stick
  // without waiting on a server round-trip / route refresh.
  const [quote, setQuote] = useState<QuoteDetail | null>(selectedQuoteProp);

  // If parent gives us a different quote (navigated to a new retainer), sync.
  const selectedQuoteId = selectedQuoteProp?.id ?? null;
  useMemo(() => {
    setQuote(selectedQuoteProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuoteId]);

  const filtered = useMemo(() => {
    const INACTIVE = new Set(["Rejected", "Cancelled"]);
    const q = query.trim().toLowerCase();
    return retainers.filter((r) => {
      if (activeOnly && r.dealStage && INACTIVE.has(r.dealStage)) return false;
      if (!q) return true;
      const hay = `${r.projectName} ${r.clientName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [retainers, query, activeOnly]);

  function selectRetainer(id: string) {
    startTransition(() => {
      router.push(`/engineering/retainer-timesheets?retainer=${id}`);
    });
  }

  const originalStories = useMemo(
    () => quote?.stories.filter((s) => !s.isChangeOrder) ?? [],
    [quote?.stories],
  );

  return (
    <div className="space-y-5">
      {/* Retainer picker */}
      <section className="bg-surface border border-rule rounded-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
              Pick a retainer
            </div>
            <div className="text-[12px] text-ink-muted mt-0.5">
              {filtered.length} shown · {retainers.length} total
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-ink-muted flex items-center gap-1.5 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="accent-emerald"
              />
              Active only
            </label>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client or project…"
              className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded-md focus:border-emerald focus:outline-none w-64"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-ink-muted">
            No retainers match.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {filtered.map((r) => {
              const isSelected = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectRetainer(r.id)}
                  className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "border-emerald bg-emerald/10"
                      : "border-rule bg-bg-elevated hover:border-ink-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-ink-muted truncate">
                      {r.clientName ?? "—"}
                    </div>
                    <span className={`${chipCls} ${stageTone(r.dealStage)}`}>
                      {r.dealStage ?? "—"}
                    </span>
                  </div>
                  <div className="text-[13px] font-medium text-ink-strong mt-0.5 truncate">
                    {r.projectName}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1 font-mono tabnum">
                    {r.storiesCount} {r.storiesCount === 1 ? "story" : "stories"}
                    {r.totalHours != null && ` · ${r.totalHours.toFixed(1)}h`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected retainer stories */}
      {quote ? (
        <section className="bg-surface border border-rule rounded-card">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                Retainer delivery — monthly stories
              </div>
              <div className="text-[14px] font-semibold text-ink-strong mt-0.5">
                {quote.preparedForName ?? "—"} · {quote.projectName}
              </div>
            </div>
            <Link
              href={`/pipeline/${quote.id}`}
              className="text-[11px] text-ink-muted hover:text-ink-strong underline"
            >
              Open project →
            </Link>
          </div>
          <div className="px-4 pb-4 pt-2">
            <QuoteStoriesTable
              stories={originalStories}
              totalCost={quote.originalTotalCost}
              totalHours={quote.originalTotalHours}
              canEdit={canEdit}
              onAddClick={() => setShowAddStory(true)}
              title="Monthly delivery (rolls up from stories)"
              addLabel="+ Add story"
              quoteId={quote.id}
              people={people}
              onReordered={(next) => setQuote(next)}
              onChanged={(next) => setQuote(next)}
              groupByMonth
            />
          </div>
        </section>
      ) : (
        <section className="bg-surface border border-rule rounded-card px-4 py-8 text-center text-[12px] text-ink-muted">
          Pick a retainer above to see and log stories.
        </section>
      )}

      {quote && (
        <NewQuoteStoryModal
          open={showAddStory}
          quoteId={quote.id}
          onClose={() => setShowAddStory(false)}
          onCreated={(next) => setQuote(next)}
          isRetainer
        />
      )}
    </div>
  );
}
