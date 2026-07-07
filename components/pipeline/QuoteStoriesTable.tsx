"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";

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

import type { PersonOption, QuoteStoryRow, QuoteDetail } from "@/lib/quote-types";
import {
  reorderQuoteStories,
  bulkDeleteQuoteStories,
  bulkUpdateQuoteStoriesFields,
} from "@/lib/mutations/quote";
import { updateStory } from "@/lib/mutations/story";

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
  people: PersonOption[];
  onReordered?: (next: QuoteDetail) => void;
  onChanged?: (next: QuoteDetail) => void;
  groupByMonth?: boolean;
};

const STORY_STATUSES = [
  "Todo",
  "In progress",
  "QA Review",
  "Completed",
  "On Hold",
  "Incomplete",
  "Analysis Required",
  "Archived",
] as const;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function statusTone(status: string | null): string {
  if (!status) return "bg-bg-elevated text-ink-muted";
  if (status === "Completed") return "bg-emerald/15 text-emerald";
  if (status === "In progress") return "bg-sky/15 text-sky";
  if (status === "QA Review") return "bg-violet/15 text-violet";
  if (status === "On Hold") return "bg-amber/15 text-amber";
  if (status === "Todo") return "bg-bg-elevated text-ink";
  return "bg-bg-elevated text-ink-muted";
}

// ---------- Inline editors ----------

function stopBubble(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function InlineText({
  value,
  onSave,
  disabled,
  multiline = false,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) setDraft(value);
  }, [value, pending]);

  const commit = async () => {
    if (draft === value) return;
    setPending(true);
    try {
      await onSave(draft);
    } finally {
      setPending(false);
    }
  };

  const baseCls =
    "w-full bg-transparent border border-transparent hover:border-rule focus:border-emerald focus:bg-bg-elevated rounded px-1.5 py-1 text-[12px] text-ink focus:outline-none disabled:opacity-60";

  if (multiline) {
    return (
      <textarea
        value={draft}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={stopBubble}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        disabled={disabled || pending}
        className={`${baseCls} resize-y min-h-[2rem]`}
      />
    );
  }
  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={stopBubble}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={disabled || pending}
      className={baseCls}
    />
  );
}

function InlineNumber({
  value,
  onSave,
  disabled,
  isCurrency = false,
}: {
  value: number | null;
  onSave: (v: number | null) => Promise<void>;
  disabled?: boolean;
  isCurrency?: boolean;
}) {
  const initial = value == null ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) setDraft(value == null ? "" : String(value));
  }, [value, pending]);

  const commit = async () => {
    const parsed = draft.trim() === "" ? null : Number(draft);
    if (parsed != null && !isFinite(parsed)) return;
    if (parsed === value) return;
    setPending(true);
    try {
      await onSave(parsed);
    } finally {
      setPending(false);
    }
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      step={isCurrency ? "0.01" : "0.1"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={stopBubble}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(initial);
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={disabled || pending}
      className="w-full bg-transparent border border-transparent hover:border-rule focus:border-emerald focus:bg-bg-elevated rounded px-1.5 py-1 text-[12px] text-ink-strong font-mono tabnum text-right focus:outline-none disabled:opacity-60"
    />
  );
}

function InlineStatus({
  value,
  onSave,
  disabled,
}: {
  value: string | null;
  onSave: (v: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  return (
    <select
      value={value ?? ""}
      onChange={async (e) => {
        const next = e.target.value;
        if (!next || next === value) return;
        setPending(true);
        try {
          await onSave(next);
        } finally {
          setPending(false);
        }
      }}
      onClick={stopBubble}
      disabled={disabled || pending}
      className={`px-1.5 py-1 text-[11px] font-medium rounded border border-transparent hover:border-rule focus:border-emerald focus:outline-none cursor-pointer disabled:opacity-60 ${statusTone(value)}`}
    >
      {!value && <option value="">—</option>}
      {STORY_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-bg-elevated text-ink">{s}</option>
      ))}
    </select>
  );
}

function InlineAssignees({
  selectedIds,
  options,
  onSave,
  disabled,
}: {
  selectedIds: string[];
  options: PersonOption[];
  onSave: (ids: string[]) => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOpts = useMemo(
    () => options.filter((o) => selectedSet.has(o.id)),
    [options, selectedSet],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            (o.email ?? "").toLowerCase().includes(q),
        )
      : options;
    return list.slice(0, 50);
  }, [options, query]);

  async function toggle(id: string) {
    const next = selectedSet.has(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setPending(true);
    try {
      await onSave(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative" onClick={stopBubble}>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-1.5 py-1 rounded border border-transparent hover:border-rule focus:border-emerald focus:outline-none disabled:opacity-60"
      >
        {selectedOpts.length === 0 ? (
          <span className="text-ink-faint text-[11px]">— assign —</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedOpts.map((a) => (
              <span key={a.id} className="px-1.5 py-0.5 rounded bg-bg text-[10px] text-ink">
                {a.name}
              </span>
            ))}
          </div>
        )}
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setQuery(""); }} />
          <div className="absolute z-40 mt-1 w-[240px] bg-surface border border-rule rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search engineer…"
              className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border-b border-rule text-ink focus:outline-none"
            />
            <div className="overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-2.5 py-3 text-[11px] text-ink-faint">No matches.</div>
              )}
              {filtered.map((o) => {
                const checked = selectedSet.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-bg-elevated ${checked ? "bg-emerald/10" : ""}`}
                  >
                    <input type="checkbox" checked={checked} readOnly className="accent-emerald w-3 h-3 pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-ink">{o.name}</div>
                      {o.email && <div className="text-[10px] text-ink-faint truncate font-mono">{o.email}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Tags chip editor ----------

function TagChipEditor({
  tags,
  suggestions,
  onSave,
  disabled,
}: {
  tags: string[];
  suggestions: string[];
  onSave: (next: string[]) => Promise<void>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const listId = useMemo(() => `tags-suggest-${Math.random().toString(36).slice(2, 8)}`, []);

  async function commitList(next: string[]) {
    const cleaned = Array.from(new Set(next.map((t) => t.trim()).filter(Boolean)));
    if (cleaned.length === tags.length && cleaned.every((t, i) => t === tags[i])) return;
    setPending(true);
    try {
      await onSave(cleaned);
    } finally {
      setPending(false);
    }
  }

  async function addFromDraft() {
    const parts = draft
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setDraft("");
      return;
    }
    setDraft("");
    await commitList([...tags, ...parts]);
  }

  async function removeAt(i: number) {
    const next = tags.slice();
    next.splice(i, 1);
    await commitList(next);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 px-1 py-0.5 min-h-[28px]"
      onClick={stopBubble}
    >
      {tags.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky/15 text-sky text-[10px] font-medium"
        >
          {t}
          {!disabled && (
            <button
              type="button"
              onClick={() => void removeAt(i)}
              className="text-sky/70 hover:text-sky leading-none"
              aria-label={`Remove tag ${t}`}
              disabled={pending}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <>
          <input
            type="text"
            list={listId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                void addFromDraft();
              } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
                e.preventDefault();
                void removeAt(tags.length - 1);
              } else if (e.key === "Escape") {
                setDraft("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={() => void addFromDraft()}
            placeholder={tags.length === 0 ? "+ tag" : ""}
            disabled={pending}
            className="flex-1 min-w-[60px] bg-transparent border border-transparent hover:border-rule focus:border-emerald focus:bg-bg-elevated rounded px-1 py-0.5 text-[11px] text-ink focus:outline-none disabled:opacity-60"
          />
          <datalist id={listId}>
            {suggestions
              .filter((s) => !tags.includes(s))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        </>
      )}
    </div>
  );
}

// ---------- Sortable row ----------

type SortableStoryRowProps = {
  story: QuoteStoryRow;
  canEdit: boolean;
  onRowClick?: (storyId: string) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  engineers: PersonOption[];
  onPatch: (id: string, patch: { name?: string; description?: string; clientNotes?: string; hours?: number | null; cost?: number | null; status?: string; assigneeIds?: string[]; completedDate?: string | null }) => Promise<void>;
  pending: boolean;
  /** Retainer mode: hide Cost column, show Completed Date column. */
  groupByMonth?: boolean;
};

function SortableStoryRow({
  story: s,
  canEdit,
  onRowClick,
  selected,
  onToggleSelect,
  engineers,
  onPatch,
  pending,
  groupByMonth = false,
}: SortableStoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: s.id,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-rule-soft last:border-0 align-top ${selected ? "bg-emerald/5" : ""} ${onRowClick ? "hover:bg-bg-elevated/60 transition-colors" : ""}`}
    >
      {/* Drag handle */}
      <td className="px-2 py-2 w-[28px] whitespace-nowrap" onClick={stopBubble}>
        {canEdit ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted px-1 select-none"
            tabIndex={-1}
            disabled={pending}
          >
            ⋮⋮
          </button>
        ) : null}
      </td>

      {/* Checkbox */}
      <td className="px-2 py-2 w-[28px]" onClick={stopBubble}>
        {canEdit && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(s.id)}
            className="accent-emerald w-3.5 h-3.5"
            aria-label="Select story"
          />
        )}
      </td>

      <td className="px-2 py-1.5 max-w-[180px]">
        {canEdit ? (
          <InlineText value={s.name} onSave={(v) => onPatch(s.id, { name: v })} />
        ) : onRowClick ? (
          <button
            type="button"
            onClick={() => onRowClick(s.id)}
            className="px-1.5 py-1 text-ink-strong font-medium truncate text-left hover:text-emerald hover:underline underline-offset-2 w-full"
            title={`Open ${s.name}`}
          >
            {s.name}
          </button>
        ) : (
          <div className="px-1.5 py-1 text-ink font-medium truncate" title={s.name}>{s.name}</div>
        )}
      </td>


      <td className="px-2 py-1.5 max-w-[240px]">
        {canEdit ? (
          <InlineText value={s.description} multiline onSave={(v) => onPatch(s.id, { description: v })} placeholder="—" />
        ) : (
          <div className="px-1.5 py-1 text-ink-muted line-clamp-2" title={s.description}>{s.description || "—"}</div>
        )}
      </td>

      <td className="px-2 py-1.5 w-[80px]">
        {canEdit ? (
          <InlineNumber value={s.hours} onSave={(v) => onPatch(s.id, { hours: v })} />
        ) : (
          <div className="px-1.5 py-1 text-right tabnum text-ink font-mono">
            {s.hours != null ? s.hours.toFixed(1) : "—"}
          </div>
        )}
      </td>

      {groupByMonth ? (
        <td className="px-2 py-1.5 w-[130px]" onClick={stopBubble}>
          {canEdit ? (
            <input
              type="date"
              value={s.completedDate ?? ""}
              onChange={(e) => void onPatch(s.id, { completedDate: e.target.value || null })}
              disabled={pending}
              className="w-full bg-transparent border border-transparent hover:border-rule focus:border-emerald focus:bg-bg-elevated rounded px-1.5 py-1 text-[12px] text-ink font-mono focus:outline-none disabled:opacity-60"
            />
          ) : (
            <div className="px-1.5 py-1 text-ink-muted font-mono text-[11px]">
              {s.completedDate ?? "—"}
            </div>
          )}
        </td>
      ) : (
        <td className="px-2 py-1.5 w-[110px]">
          {canEdit ? (
            <InlineNumber value={s.cost} onSave={(v) => onPatch(s.id, { cost: v })} isCurrency />
          ) : (
            <div className="px-1.5 py-1 text-right tabnum text-ink-strong font-mono">
              {s.cost != null ? fmtMoney(s.cost) : "—"}
            </div>
          )}
        </td>
      )}

      <td className="px-2 py-1.5 max-w-[200px]">
        {canEdit ? (
          <InlineText value={s.clientNotes} multiline onSave={(v) => onPatch(s.id, { clientNotes: v })} placeholder="—" />
        ) : (
          <div className="px-1.5 py-1 text-ink-muted line-clamp-2" title={s.clientNotes}>{s.clientNotes || "—"}</div>
        )}
      </td>

      <td className="px-2 py-1.5 w-[140px]">
        {canEdit ? (
          <InlineStatus value={s.status} onSave={(v) => onPatch(s.id, { status: v })} />
        ) : (
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusTone(s.status)}`}>
            {s.status ?? "—"}
          </span>
        )}
      </td>

      <td className="px-2 py-1.5 min-w-[160px]">
        {canEdit ? (
          <InlineAssignees
            selectedIds={s.assignees.map((a) => a.id)}
            options={engineers}
            onSave={(ids) => onPatch(s.id, { assigneeIds: ids })}
          />
        ) : s.assignees.length === 0 ? (
          <span className="text-ink-faint px-1.5">—</span>
        ) : (
          <div className="flex flex-wrap gap-1 px-1.5">
            {s.assignees.map((a) => (
              <span key={a.id} className="px-1.5 py-0.5 rounded bg-bg text-[10px] text-ink">{a.name}</span>
            ))}
          </div>
        )}
      </td>

      <td className="px-2 py-1.5 w-[80px] text-right" onClick={stopBubble}>
        {onRowClick && (
          <button
            type="button"
            onClick={() => onRowClick(s.id)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-ink-muted hover:text-emerald border border-rule hover:border-emerald rounded transition-colors"
            title="Open story details"
          >
            <span>Open</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </td>

    </tr>
  );
}


// ---------- Bulk action bar ----------

function BulkBar({
  selectedCount,
  engineers,
  onClear,
  onDelete,
  onReassign,
  onStatus,
  pending,
}: {
  selectedCount: number;
  engineers: PersonOption[];
  onClear: () => void;
  onDelete: () => void;
  onReassign: (ids: string[]) => void;
  onStatus: (status: string) => void;
  pending: boolean;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [query, setQuery] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? engineers.filter((e) => e.name.toLowerCase().includes(q)) : engineers).slice(0, 50);
  }, [engineers, query]);

  return (
    <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-emerald/5 border border-emerald/30 rounded-md mb-2">
      <span className="text-[12px] text-ink-strong font-medium">{selectedCount} selected</span>

      <select
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          e.currentTarget.value = "";
          if (v) onStatus(v);
        }}
        className="px-2 py-1 text-[11px] bg-bg-elevated border border-rule rounded text-ink cursor-pointer disabled:opacity-50"
      >
        <option value="">Change status…</option>
        {STORY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="relative">
        <button
          type="button"
          disabled={pending}
          onClick={() => { setShowAssign((o) => !o); setPickedIds([]); }}
          className="px-2 py-1 text-[11px] bg-bg-elevated border border-rule rounded text-ink hover:border-ink-muted disabled:opacity-50"
        >
          Assign engineer ▾
        </button>
        {showAssign && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowAssign(false)} />
            <div className="absolute z-40 mt-1 w-[260px] bg-surface border border-rule rounded-md shadow-lg max-h-72 overflow-hidden flex flex-col">
              <input
                autoFocus
                type="text"
                placeholder="Search engineer…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border-b border-rule text-ink focus:outline-none"
              />
              <div className="overflow-y-auto">
                {filtered.map((o) => {
                  const checked = pickedIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPickedIds((p) => p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id])}
                      className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-bg-elevated ${checked ? "bg-emerald/10" : ""}`}
                    >
                      <input type="checkbox" checked={checked} readOnly className="accent-emerald w-3 h-3 pointer-events-none" />
                      <span className="truncate text-ink">{o.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 px-2 py-2 border-t border-rule bg-bg-elevated">
                <button
                  type="button"
                  onClick={() => { onReassign([]); setShowAssign(false); }}
                  className="text-[11px] text-red hover:underline"
                >
                  Clear assignees
                </button>
                <button
                  type="button"
                  disabled={pickedIds.length === 0}
                  onClick={() => { onReassign(pickedIds); setShowAssign(false); }}
                  className="px-2 py-1 text-[11px] bg-emerald text-bg font-semibold rounded disabled:opacity-50"
                >
                  Apply ({pickedIds.length})
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={onDelete}
        className="px-2 py-1 text-[11px] bg-red/10 border border-red/40 text-red rounded hover:bg-red/20 disabled:opacity-50"
      >
        Delete
      </button>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-[11px] text-ink-muted hover:text-ink-strong"
      >
        Clear selection
      </button>
    </div>
  );
}

// ---------- Month group renderer ----------

function FragmentGroup({
  group,
  canEdit,
  onRowClick,
  selected,
  onToggleSelect,
  engineers,
  onPatch,
  pending,
  groupByMonth = false,
  collapsed = false,
  onToggleCollapsed,
  isCurrent = false,
}: {
  group: { key: string; label: string; stories: QuoteStoryRow[]; totalCost: number; totalHours: number };
  canEdit: boolean;
  onRowClick?: (id: string) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  engineers: PersonOption[];
  onPatch: (id: string, p: { name?: string; description?: string; clientNotes?: string; hours?: number | null; cost?: number | null; status?: string; assigneeIds?: string[]; completedDate?: string | null }) => Promise<void>;
  pending: boolean;
  groupByMonth?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: (key: string) => void;
  isCurrent?: boolean;
}) {
  return (
    <>
      <tr className="bg-bg-elevated border-y border-rule">
        <td colSpan={10} className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onToggleCollapsed?.(group.key)}
              className="flex items-center gap-2 text-left group"
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-ink-strong transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-ink-muted group-hover:text-ink-strong transition-colors" />
              )}
              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald" aria-hidden />}
              <span className="text-[14px] font-semibold text-ink-strong group-hover:text-emerald transition-colors">
                {group.label}
              </span>
              {isCurrent && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald">Current</span>
              )}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded border border-rule bg-bg/60 text-[11px] font-mono tabnum text-ink">
                {group.stories.length} {group.stories.length === 1 ? "story" : "stories"}
              </span>
              <span className="px-2 py-0.5 rounded border border-rule bg-bg/60 text-[11px] font-mono tabnum text-ink-strong">
                {group.totalHours}h
              </span>
              {!groupByMonth && (
                <span className="px-2 py-0.5 rounded border border-rule bg-bg/60 text-[11px] font-mono tabnum text-ink-strong">
                  {fmtMoney(group.totalCost)}
                </span>
              )}
            </div>
          </div>
        </td>
      </tr>
      {!collapsed &&
        group.stories.map((s) => (
          <SortableStoryRow
            key={s.id}
            story={s}
            canEdit={canEdit}
            onRowClick={onRowClick}
            selected={selected.has(s.id)}
            onToggleSelect={onToggleSelect}
            engineers={engineers}
            onPatch={onPatch}
            pending={pending}
            groupByMonth={groupByMonth}
          />
        ))}
    </>
  );
}



// ---------- Main table ----------

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
  people,
  onReordered,
  onChanged,
  groupByMonth = false,
}: Props) {
  const [localStories, setLocalStories] = useState<QuoteStoryRow[]>(stories);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  

  // Hydrate persisted collapsed state (client-only) once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`qst:${quoteId}:collapsedMonths`);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setCollapsedMonths(new Set(arr));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  function toggleCollapsedMonth(key: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            `qst:${quoteId}:collapsedMonths`,
            JSON.stringify([...next]),
          );
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }


  useEffect(() => {
    setLocalStories(stories);
    // Drop selection for stories that disappeared.
    setSelected((prev) => {
      const ids = new Set(stories.map((s) => s.id));
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next;
    });
  }, [stories]);

  const engineerOptions = useMemo(
    () => people.filter((p) => p.isInternal && p.isActive),
    [people],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => localStories.map((s) => s.id), [localStories]);

  const monthKeyFor = (s: QuoteStoryRow): string => {
    const src = s.completedDate || s.createdTime;
    if (!src) return "0000-00-unscheduled";
    const d = new Date(src);
    if (isNaN(d.getTime())) return "0000-00-unscheduled";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const monthGroups = useMemo(() => {
    if (!groupByMonth) return null;
    const map = new Map<
      string,
      { key: string; label: string; stories: QuoteStoryRow[]; totalCost: number; totalHours: number }
    >();
    for (const s of localStories) {
      const key = monthKeyFor(s);
      const src = s.completedDate || s.createdTime;
      const isUnscheduled = key === "0000-00-unscheduled" || !s.completedDate;
      const label = isUnscheduled
        ? "Unscheduled"
        : src
          ? new Date(src).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "Unscheduled";
      // Re-key unscheduled to a single bucket regardless of createdTime.
      const bucketKey = isUnscheduled ? "0000-00-unscheduled" : key;
      const g = map.get(bucketKey) ?? { key: bucketKey, label, stories: [], totalCost: 0, totalHours: 0 };
      g.stories.push(s);
      g.totalCost += s.cost ?? 0;
      g.totalHours += s.hours ?? 0;
      map.set(bucketKey, g);
    }
    // Sort: Unscheduled first, then newest month → oldest.
    return [...map.values()].sort((a, b) => {
      if (a.key === "0000-00-unscheduled") return -1;
      if (b.key === "0000-00-unscheduled") return 1;
      return b.key.localeCompare(a.key);
    });
  }, [groupByMonth, localStories]);

  function commitReorder(next: QuoteStoryRow[]) {
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
    if (groupByMonth) {
      const a = localStories[oldIndex];
      const b = localStories[newIndex];
      if (monthKeyFor(a) !== monthKeyFor(b)) return;
    }
    commitReorder(arrayMove(localStories, oldIndex, newIndex));
  }

  async function patchStory(
    id: string,
    p: { name?: string; description?: string; clientNotes?: string; hours?: number | null; cost?: number | null; status?: string; assigneeIds?: string[]; completedDate?: string | null },
  ) {
    // Optimistic local update
    setLocalStories((prev) =>
      prev.map((s) =>
        s.id !== id
          ? s
          : {
              ...s,
              ...(p.name !== undefined ? { name: p.name } : {}),
              ...(p.description !== undefined ? { description: p.description } : {}),
              ...(p.clientNotes !== undefined ? { clientNotes: p.clientNotes } : {}),
              ...(p.hours !== undefined ? { hours: p.hours } : {}),
              ...(p.cost !== undefined ? { cost: p.cost } : {}),
              ...(p.status !== undefined ? { status: p.status } : {}),
              ...(p.completedDate !== undefined ? { completedDate: p.completedDate } : {}),
              ...(p.assigneeIds !== undefined
                ? {
                    assignees: p.assigneeIds
                      .map((aid) => {
                        const o = people.find((x) => x.id === aid);
                        return o ? { id: o.id, name: o.name } : null;
                      })
                      .filter(Boolean) as { id: string; name: string }[],
                  }
                : {}),
            },
      ),
    );

    const patch: Parameters<typeof updateStory>[1] = {};
    if (p.name !== undefined) patch.name = p.name;
    if (p.description !== undefined) patch.description = p.description;
    if (p.clientNotes !== undefined) patch.clientNotes = p.clientNotes;
    if (p.hours !== undefined) patch.hours = p.hours;
    if (p.cost !== undefined) patch.invoice = p.cost;
    if (p.status !== undefined) patch.status = p.status;
    if (p.assigneeIds !== undefined) patch.assigneeIds = p.assigneeIds;
    if (p.completedDate !== undefined) patch.completedDate = p.completedDate;

    if (Object.keys(patch).length > 0) {
      await updateStory(id, patch);
    }
  }


  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === localStories.length) setSelected(new Set());
    else setSelected(new Set(localStories.map((s) => s.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} ${ids.length === 1 ? "story" : "stories"}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await bulkDeleteQuoteStories(quoteId, ids);
      if ("ok" in res) {
        clearSelection();
        if (onChanged) onChanged(res.quote);
      } else {
        window.alert(res.error);
      }
    });
  }

  async function handleBulkStatus(status: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdateQuoteStoriesFields(quoteId, ids, { status });
      if ("ok" in res) {
        clearSelection();
        if (onChanged) onChanged(res.quote);
      } else {
        window.alert(res.error);
      }
    });
  }

  async function handleBulkReassign(assigneeIds: string[]) {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdateQuoteStoriesFields(quoteId, ids, { assigneeIds });
      if ("ok" in res) {
        clearSelection();
        if (onChanged) onChanged(res.quote);
      } else {
        window.alert(res.error);
      }
    });
  }

  const allSelected = localStories.length > 0 && selected.size === localStories.length;

  return (
    <div className="bg-bg-elevated/60 border border-rule rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-rule bg-bg-elevated">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{title}</div>
          <div className="mt-0.5 flex items-baseline gap-3">
            {groupByMonth ? (
              <div className="text-[20px] font-semibold text-ink-strong tabnum leading-none">
                {totalHours ?? 0}h
              </div>
            ) : (
              <div className="text-[20px] font-semibold text-ink-strong tabnum leading-none">{fmtMoney(totalCost)}</div>
            )}
            {!groupByMonth && totalHours != null && (
              <div className="text-[11px] text-ink-muted font-mono tabnum">
                {totalHours}h · {localStories.length} {localStories.length === 1 ? "story" : "stories"}
              </div>
            )}
            {groupByMonth && (
              <div className="text-[11px] text-ink-muted font-mono tabnum">
                {localStories.length} {localStories.length === 1 ? "story" : "stories"}
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


      {canEdit && selected.size > 0 && (
        <div className="px-3 pt-2">
          <BulkBar
            selectedCount={selected.size}
            engineers={engineerOptions}
            onClear={clearSelection}
            onDelete={handleBulkDelete}
            onReassign={handleBulkReassign}
            onStatus={handleBulkStatus}
            pending={pending}
          />
        </div>
      )}

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
                  <th className="px-2 py-2 font-medium w-[28px]"></th>
                  <th className="px-2 py-2 font-medium w-[28px]">
                    {canEdit && (
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="accent-emerald w-3.5 h-3.5"
                        aria-label="Select all"
                      />
                    )}
                  </th>
                  <th className="px-2 py-2 font-medium">Story Name</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium text-right tabnum">Hours</th>
                  {groupByMonth ? (
                    <th className="px-2 py-2 font-medium">Completed</th>
                  ) : (
                    <th className="px-2 py-2 font-medium text-right tabnum">Cost</th>
                  )}
                  <th className="px-2 py-2 font-medium">Client Notes</th>
                  <th className="px-2 py-2 font-medium whitespace-nowrap">
                    Story Status<span className="ml-1 text-ink-faint normal-case tracking-normal">(internal)</span>
                  </th>
                  <th className="px-2 py-2 font-medium whitespace-nowrap">
                    Engineer Assigned<span className="ml-1 text-ink-faint normal-case tracking-normal">(internal)</span>
                  </th>
                  <th className="px-2 py-2 font-medium w-[80px]"></th>
                </tr>
              </thead>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <tbody className="row-zebra">
                  {monthGroups
                    ? monthGroups.map((g) => (
                        <FragmentGroup
                          key={g.key}
                          group={g}
                          canEdit={canEdit}
                          onRowClick={onRowClick}
                          selected={selected}
                          onToggleSelect={toggleSelect}
                          engineers={engineerOptions}
                          onPatch={patchStory}
                          pending={pending}
                          groupByMonth={groupByMonth}
                          collapsed={collapsedMonths.has(g.key)}
                          onToggleCollapsed={toggleCollapsedMonth}
                          isCurrent={g.key === currentMonthKey}
                        />

                      ))
                    : localStories.map((s) => (
                        <SortableStoryRow
                          key={s.id}
                          story={s}
                          canEdit={canEdit}
                          onRowClick={onRowClick}
                          selected={selected.has(s.id)}
                          onToggleSelect={toggleSelect}
                          engineers={engineerOptions}
                          onPatch={patchStory}
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
