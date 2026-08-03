"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EngineerGroup, Story } from "@/lib/engineering-types";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { StoryTable } from "./StoryTable";

type Props = {
  group: EngineerGroup;
  stories: Story[]; // pre-filtered by the board
  maxAssigned: number; // max activeHoursAssigned across engineers, for bar scaling
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelectStory: (s: Story) => void;
};

export function RosterRow({
  group,
  stories,
  maxAssigned,
  expanded,
  onToggle,
  selectedId,
  onSelectStory,
}: Props) {
  const t = group.totals;
  const barPct =
    maxAssigned > 0 ? Math.min(100, (t.activeHoursAssigned / maxAssigned) * 100) : 0;

  // Card-local filters — options come only from this engineer's own stories.
  const [cardClient, setCardClient] = useState<string | null>(null);
  const [cardStatus, setCardStatus] = useState<string | null>(null);

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) for (const c of s.clientNames) set.add(c);
    return [...set].sort().map((c) => ({ value: c, label: c }));
  }, [stories]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) if (s.status) set.add(s.status);
    return [...set].sort();
  }, [stories]);

  const visibleStories = useMemo(
    () =>
      stories.filter(
        (s) =>
          (!cardClient || s.clientNames.includes(cardClient)) &&
          (!cardStatus || s.status === cardStatus),
      ),
    [stories, cardClient, cardStatus],
  );

  return (
    <section
      className={`bg-surface border border-rule rounded-card overflow-hidden ${
        group.isOrphan ? "border-red/30" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${group.isOrphan ? "bg-red" : "bg-emerald"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold text-ink-strong leading-tight truncate">
                {group.name}
              </span>
              <span className="hidden sm:flex items-center gap-3 shrink-0 text-[11px] font-mono text-ink-muted tabnum">
                {t.inProgressCount > 0 && (
                  <span className="text-emerald">{t.inProgressCount} doing</span>
                )}
                {t.todoCount > 0 && <span>{t.todoCount} todo</span>}
                {t.qaCount > 0 && <span className="text-sky">{t.qaCount} QA</span>}
                <span className="text-ink-strong">{t.activeHoursAssigned}h</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${group.isOrphan ? "bg-red" : "bg-emerald"}`}
                style={{ width: `${Math.max(barPct, 2)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-ink-muted truncate">
              {group.isOrphan
                ? "Stories waiting for an engineer"
                : (group.role ?? "Engineer") +
                  (group.internalType ? ` · ${group.internalType}` : "")}
            </div>
          </div>
        </div>
        <span className="text-ink-faint text-[14px] font-mono w-3 shrink-0">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-rule">
          <div className="px-4 py-2 bg-bg-elevated border-b border-rule flex items-center justify-between gap-3 flex-wrap text-[11px]">
            <div className="flex items-center gap-2 flex-wrap">
              <SearchableSelect
                value={cardClient}
                onChange={setCardClient}
                options={clientOptions}
                allLabel="All clients"
              />
              <select
                value={cardStatus ?? ""}
                onChange={(e) => setCardStatus(e.target.value || null)}
                className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer"
                aria-label="Status filter for this engineer"
              >
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {(cardClient || cardStatus) && (
                <span className="font-mono text-ink-faint tabnum">
                  {visibleStories.length} of {stories.length}
                </span>
              )}
            </div>
            {group.isOrphan ? (
              <Link
                href="/hygiene/orphans"
                className="text-red hover:text-red/80 transition-colors font-mono"
              >
                Triage →
              </Link>
            ) : (
              <Link
                href={`/me?as=${group.id}`}
                className="text-emerald hover:text-emerald/80 transition-colors font-mono"
              >
                View scorecard →
              </Link>
            )}
          </div>
          <StoryTable stories={visibleStories} selectedId={selectedId} onSelect={onSelectStory} />
        </div>
      )}
    </section>
  );
}
