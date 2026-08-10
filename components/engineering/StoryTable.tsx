"use client";

import { useMemo } from "react";
import { Story } from "@/lib/engineering-types";
import { statusTone, priorityDot } from "./story-badges";

type Props = {
  stories: Story[];
  selectedId: string | null;
  onSelect: (s: Story) => void;
  /** Hide the Client column — for tables already grouped by client. */
  hideClient?: boolean;
  /** Keep the caller's ordering instead of sorting by story number. */
  preserveOrder?: boolean;
};

// Compact one-row-per-story table. Pay/quote/description details live in the
// StorySheet drawer — this view is for scanning and comparing.
const GRID =
  "lg:grid lg:grid-cols-[120px_52px_86px_minmax(220px,1fr)_minmax(130px,0.5fr)_56px] lg:gap-3 lg:items-center";
const GRID_NO_CLIENT =
  "lg:grid lg:grid-cols-[120px_52px_86px_minmax(220px,1fr)_56px] lg:gap-3 lg:items-center";

export function StoryTable({
  stories,
  selectedId,
  onSelect,
  hideClient = false,
  preserveOrder = false,
}: Props) {
  const grid = hideClient ? GRID_NO_CLIENT : GRID;
  // Sort by story number ascending; stories without a number sink to the end.
  const sorted = useMemo(
    () =>
      preserveOrder
        ? stories
        : [...stories].sort((a, b) => {
            if (a.storyNumber == null) return b.storyNumber == null ? 0 : 1;
            if (b.storyNumber == null) return -1;
            return a.storyNumber - b.storyNumber;
          }),
    [stories, preserveOrder],
  );

  if (stories.length === 0) {
    return (
      <div className="px-4 py-4 text-[12px] text-ink-muted">
        No stories match the current filter.
      </div>
    );
  }

  return (
    <div>
      <div
        className={`hidden ${grid} border-b border-rule px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-faint`}
      >
        <div>Status</div>
        <div>#</div>
        <div>Priority</div>
        <div>Story</div>
        {!hideClient && <div>Client</div>}
        <div className="text-right">Est</div>
      </div>

      <div className="divide-y divide-rule">
        {sorted.map((s) => {
          const isSelected = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={`block w-full px-4 py-2 text-left transition-colors hover:bg-bg-elevated ${grid} ${
                isSelected ? "bg-emerald/5 ring-1 ring-inset ring-emerald/30" : ""
              }`}
            >
              {/* Status */}
              <div className="mb-1 lg:mb-0">
                <span
                  className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${statusTone(s.status)}`}
                >
                  {s.status ?? "—"}
                </span>
              </div>

              {/* Number — desktop only; folded into the name line on mobile */}
              <div className="hidden font-mono text-[11px] text-ink-faint tabnum lg:block">
                {s.storyNumber != null ? `#${s.storyNumber}` : "—"}
              </div>

              {/* Priority */}
              <div className="hidden items-center gap-1.5 lg:flex">
                {s.priority ? (
                  <>
                    <span className={`h-1.5 w-1.5 rounded-full ${priorityDot(s.priority)}`} />
                    <span className="text-[11px] text-ink-muted">{s.priority}</span>
                  </>
                ) : (
                  <span className="text-[11px] text-ink-faint">—</span>
                )}
              </div>

              {/* Name (mobile: prefixed with # and followed by client/est line) */}
              <div className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink-strong">
                  <span className="mr-1 font-mono text-[10px] text-ink-faint lg:hidden">
                    {s.storyNumber != null ? `#${s.storyNumber}` : ""}
                  </span>
                  {s.name}
                  {s.assigneeNames.length > 1 && (
                    <span
                      title={`Shared: ${s.assigneeNames.join(", ")}`}
                      className="ml-1.5 inline-block align-middle rounded border border-violet/30 bg-violet/10 px-1 py-px text-[9px] font-mono uppercase tracking-wider text-violet"
                    >
                      Shared · {s.assigneeNames.length}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-muted lg:hidden">
                  {hideClient
                    ? [s.priority, s.hours != null ? `${s.hours}h est` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"
                    : `${s.clientNames[0] ?? "No client"}${s.priority ? ` · ${s.priority}` : ""}${s.hours != null ? ` · ${s.hours}h est` : ""}`}
                </span>
              </div>

              {/* Client */}
              {!hideClient && (
                <div className="hidden min-w-0 lg:block">
                  <span className="block truncate text-[12px] text-ink-muted">
                    {s.clientNames[0] ?? "—"}
                  </span>
                </div>
              )}

              {/* Est hours */}
              <div className="hidden text-right font-mono text-[11px] text-ink-strong tabnum lg:block">
                {s.hours != null ? `${s.hours}h` : "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
