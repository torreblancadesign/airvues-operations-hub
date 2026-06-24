"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { QuoteStoryRow, QuoteDetail } from "@/lib/quote-types";
import { reorderQuoteStories } from "@/lib/mutations/quote";

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
  quoteId: string;
  onReordered?: (next: QuoteDetail) => void;
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

type SortableStoryRowProps = {
  story: QuoteStoryRow;
  index: number;
  canEdit: boolean;
  onRowClick?: (storyId: string) => void;
  onOrderInputCommit: (id: string, raw: string) => void;
  pending: boolean;
};

function SortableStoryRow({
  story: s,
  index,
  canEdit,
  onRowClick,
  onOrderInputCommit,
  pending,
}: SortableStoryRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: s.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  const displayOrder = (index + 1) * 10;
  const [orderText, setOrderText] = useState<string>(String(s.order ?? displayOrder));

  useEffect(() => {
    setOrderText(String(s.order ?? displayOrder));
  }, [s.order, displayOrder]);

  return (
    <tr
      ref={setNodeRef}
      style={style}
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
      <td
        className="px-2 py-2.5 w-[64px] whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {canEdit ? (
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
              className="cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted px-1 select-none"
              tabIndex={-1}
            >
              ⋮⋮
            </button>
          ) : (
            <span className="px-1" />
          )}
          {canEdit ? (
            <input
              type="number"
              inputMode="numeric"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              onBlur={() => onOrderInputCommit(s.id, orderText)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={pending}
              className="w-10 px-1 py-0.5 text-[11px] tabnum font-mono bg-bg border border-rule rounded text-ink-strong focus:border-emerald focus:outline-none"
            />
          ) : (
            <span className="text-[11px] tabnum font-mono text-ink-muted">{s.order ?? displayOrder}</span>
          )}
        </div>
      </td>
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
  );
}

export function QuoteStoriesTable({
  stories,
  totalCost,
  totalHours,
  canEdit,
  onAddClick,
  onRowClick,
  title = "Quote total (rolls up from stories)",
  addLabel = "+ Add story",
  emptyLabel,
  quoteId,
  onReordered,
}: Props) {
  // Local optimistic order — driven by props but reshuffled immediately on drag/edit.
  const [localStories, setLocalStories] = useState<QuoteStoryRow[]>(stories);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLocalStories(stories);
  }, [stories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => localStories.map((s) => s.id), [localStories]);

  function commitReorder(next: QuoteStoryRow[]) {
    // Re-space ascending: 10, 20, 30…
    const updates = next.map((s, i) => ({ id: s.id, order: (i + 1) * 10 }));
    setLocalStories(next.map((s, i) => ({ ...s, order: (i + 1) * 10 })));
    startTransition(async () => {
      const res = await reorderQuoteStories(quoteId, updates);
      if ("ok" in res && onReordered) onReordered(res.quote);
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localStories.findIndex((s) => s.id === active.id);
    const newIndex = localStories.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(localStories, oldIndex, newIndex);
    commitReorder(next);
  }

  function handleOrderInputCommit(id: string, raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    // Reorder using the new desired order value; tie-break keeps the edited row
    // first when colliding with an existing value.
    const next = [...localStories]
      .map((s) => (s.id === id ? { ...s, order: parsed } : s))
      .sort((a, b) => {
        const ao = a.order ?? Number.POSITIVE_INFINITY;
        const bo = b.order ?? Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return a.id === id ? -1 : b.id === id ? 1 : 0;
      });
    commitReorder(next);
  }

  return (
    <div className="bg-bg-elevated/60 border border-rule rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-rule bg-bg-elevated">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {title}
          </div>
          <div className="mt-0.5 flex items-baseline gap-3">
            <div className="text-[20px] font-semibold text-ink-strong tabnum leading-none">
              {fmtMoney(totalCost)}
            </div>
            {totalHours != null && (
              <div className="text-[11px] text-ink-muted font-mono tabnum">
                {totalHours}h · {localStories.length} {localStories.length === 1 ? "story" : "stories"}
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
            {addLabel}
          </button>
        )}
      </div>

      {localStories.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-ink-faint">
          {emptyLabel ?? `No stories yet.${canEdit ? " Click + Add story to build the quote." : ""}`}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted border-b border-rule">
                  <th className="px-2 py-2 font-medium w-[64px]">#</th>
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
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <tbody className="row-zebra">
                  {localStories.map((s, i) => (
                    <SortableStoryRow
                      key={s.id}
                      story={s}
                      index={i}
                      canEdit={canEdit}
                      onRowClick={onRowClick}
                      onOrderInputCommit={handleOrderInputCommit}
                      pending={pending}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}
    </div>
  );
}
