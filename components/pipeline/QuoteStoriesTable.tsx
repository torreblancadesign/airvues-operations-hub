"use client";

import type { QuoteStoryRow } from "@/lib/quote-types";

type Props = {
  stories: QuoteStoryRow[];
  totalCost: number;
  totalHours: number | null;
  canEdit: boolean;
  onAddClick: () => void;
  onRowClick?: (storyId: string) => void;
  title?: string;
  addLabel?: string;
  emptyLabel?: string;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-ink-faint">—</span>;
  const tone =
    status === "Completed"
      ? "bg-emerald/15 text-emerald"
      : status === "In progress"
        ? "bg-sky/15 text-sky"
        : status === "QA Review"
          ? "bg-violet/15 text-violet"
          : status === "On Hold"
            ? "bg-amber/15 text-amber"
            : status === "Todo"
              ? "bg-bg-elevated text-ink"
              : "bg-bg-elevated text-ink-muted";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${tone}`}>
      {status}
    </span>
  );
}

export function QuoteStoriesTable({ stories, totalCost, totalHours, canEdit, onAddClick, onRowClick }: Props) {
  return (
    <div className="bg-bg-elevated/60 border border-rule rounded-md overflow-hidden">
      {/* Totals + Add story strip */}
      <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-rule bg-bg-elevated">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Quote total (rolls up from stories)
          </div>
          <div className="mt-0.5 flex items-baseline gap-3">
            <div className="text-[20px] font-semibold text-ink-strong tabnum leading-none">
              {fmtMoney(totalCost)}
            </div>
            {totalHours != null && (
              <div className="text-[11px] text-ink-muted font-mono tabnum">
                {totalHours}h · {stories.length} {stories.length === 1 ? "story" : "stories"}
              </div>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onAddClick}
            className="px-3 py-1.5 text-[12px] font-semibold bg-emerald text-bg rounded hover:bg-emerald/80 transition-colors"
          >
            + Add story
          </button>
        )}
      </div>

      {/* Table */}
      {stories.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-ink-faint">
          No stories yet.{canEdit ? " Click + Add story to build the quote." : ""}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted border-b border-rule">
                <th className="px-3 py-2 font-medium">Story Name</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right tabnum">Hours</th>
                <th className="px-3 py-2 font-medium text-right tabnum">Cost</th>
                <th className="px-3 py-2 font-medium">Client Notes</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">
                  Story Status
                  <span className="ml-1 text-ink-faint normal-case tracking-normal">(internal)</span>
                </th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">
                  Engineer Assigned
                  <span className="ml-1 text-ink-faint normal-case tracking-normal">(internal)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {stories.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-rule-soft last:border-0 align-top ${onRowClick ? "cursor-pointer hover:bg-bg-elevated/60 transition-colors" : ""}`}
                  onClick={onRowClick ? () => onRowClick(s.id) : undefined}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(s.id);
                          }
                        }
                      : undefined
                  }
                >

                  <td className="px-3 py-2.5 text-ink font-medium max-w-[160px]">
                    <div className="truncate" title={s.name}>{s.name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted max-w-[220px]">
                    <div className="line-clamp-2" title={s.description}>
                      {s.description || <span className="text-ink-faint">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink font-mono">
                    {s.hours != null ? s.hours.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink-strong font-mono">
                    {s.cost != null ? fmtMoney(s.cost) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted max-w-[180px]">
                    <div className="line-clamp-2" title={s.clientNotes}>
                      {s.clientNotes || <span className="text-ink-faint">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted">
                    {s.assignees.length === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {s.assignees.map((a) => (
                          <span key={a.id} className="px-1.5 py-0.5 rounded bg-bg text-[10px] text-ink">
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
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
