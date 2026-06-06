"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Story } from "@/lib/engineering-types";
import { updateStory, deleteStory, duplicateStoryToNextSprint } from "@/lib/mutations/story";

type EngineerOption = { id: string; name: string };
type SprintOption = { id: string; number: number | null; status: string | null };

type Props = {
  story: Story | null;
  engineers?: EngineerOption[];
  sprints?: SprintOption[];
  canEdit?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  onDuplicated?: (newId: string, sprintNumber: number | null) => void;
  onFilterByEngineer: (engineerId: string) => void;
  onFilterByClient: (client: string) => void;
};

const STATUS_OPTIONS = [
  "Todo",
  "In progress",
  "QA Review",
  "Completed",
  "On Hold",
  "Incomplete",
  "Analysis Required",
];

const PRIORITY_OPTIONS = ["Urgent", "High", "Medium", "Low"];
const PHASE_OPTIONS = ["Phase 1", "Phase 2", "Phase 3"];


function statusToneText(status: string | null): string {
  switch (status) {
    case "In progress": return "text-emerald";
    case "QA Review": return "text-sky";
    case "Completed": return "text-violet";
    case "On Hold": return "text-amber";
    case "Incomplete": return "text-red";
    case "Analysis Required": return "text-amber";
    default: return "text-ink-strong";
  }
}

function payStatusTone(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "bg-bg-elevated text-ink-muted border-rule";
  const v = s.toLowerCase();
  if (v.includes("paid") && !v.includes("partial") && !v.includes("unpaid")) return "bg-emerald/15 text-emerald border-emerald/30";
  if (v.includes("partial") || v.includes("deposit")) return "bg-amber/15 text-amber border-amber/30";
  if (v.includes("unpaid") || v.includes("overdue") || v.includes("past due")) return "bg-red/15 text-red border-red/30";
  return "bg-bg-elevated text-ink-muted border-rule";
}



function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="py-2.5 border-b border-rule last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">
        {label}
      </div>
      <div className="text-[13px] text-ink">{children}</div>
      {hint && <div className="text-[10px] text-ink-faint mt-1">{hint}</div>}
    </div>
  );
}

const inputCls =
  "px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none transition-colors";

export function StorySheet({
  story,
  engineers = [],
  sprints = [],
  canEdit = false,
  canDelete,
  onClose,
  onDeleted,
  onDuplicated,
  onFilterByEngineer,
  onFilterByClient,
}: Props) {
  const allowDelete = canDelete ?? canEdit;
  const [local, setLocal] = useState<Partial<Story>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!story) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [story]);

  // Reset local edits when story switches
  useEffect(() => {
    setLocal({});
    setError(null);
  }, [story?.id]);

  useEffect(() => {
    if (!story) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [story, onClose]);

  if (!story || !mounted) return null;

  const current: Story = { ...story, ...local };

  const pct = current.hours && current.hours > 0
    ? Math.round(((current.hoursWorked ?? 0) / current.hours) * 100)
    : null;
  const over = pct != null && pct > 100;
  const sprintNum = current.sprintNumbers[0];
  const sprintStatus = current.sprintStatuses[0];

  function save(patch: Partial<Story>, payload: Parameters<typeof updateStory>[1]) {
    setLocal((prev) => ({ ...prev, ...patch }));
    setError(null);
    startTransition(async () => {
      const result = await updateStory(story!.id, payload);
      if (!("ok" in result)) {
        setError(result.error);
      } else {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      }
    });
  }

  function toggleAssignee(personId: string) {
    const existing = current.assigneeIds;
    const personName = engineers.find((e) => e.id === personId)?.name ?? "(unknown)";
    let nextIds: string[];
    let nextNames: string[];
    if (existing.includes(personId)) {
      const idx = existing.indexOf(personId);
      nextIds = existing.filter((id) => id !== personId);
      nextNames = current.assigneeNames.filter((_, i) => i !== idx);
    } else {
      nextIds = [...existing, personId];
      nextNames = [...current.assigneeNames, personName];
    }
    save(
      { assigneeIds: nextIds, assigneeNames: nextNames },
      { assigneeIds: nextIds },
    );
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-surface z-50 border-l border-rule shadow-xl overflow-y-auto"
        role="dialog"
        aria-label={current.name}
      >
        <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              <span>Story {current.storyNumber != null ? `#${current.storyNumber}` : ""}</span>
              {pending && <span className="text-amber">· saving…</span>}
              {savedFlash && !pending && <span className="text-emerald">· saved</span>}
              {error && <span className="text-red truncate">· {error}</span>}
            </div>
            {canEdit ? (
              <input
                key={`name-${current.id}`}
                type="text"
                defaultValue={current.name}
                disabled={pending}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && val !== current.name) save({ name: val }, { name: val });
                }}
                className="w-full text-[15px] font-semibold text-ink-strong leading-tight bg-transparent border-b border-transparent focus:border-emerald focus:outline-none"
              />
            ) : (
              <h2 className="text-[15px] font-semibold text-ink-strong leading-tight truncate">
                {current.name}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 bg-bg-elevated border-b border-rule">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-1">
            Hours scoped
          </div>
          <div className="text-[34px] font-semibold text-ink-strong tabnum leading-none">
            {current.hours ?? "—"}<span className="text-[20px] text-ink-muted">h</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                Hours worked
              </div>
              <div className="text-[20px] font-semibold text-ink-strong tabnum">
                {current.hoursWorked ?? 0}h
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                Status
              </div>
              <div className={`text-[14px] font-medium ${statusToneText(current.status)}`}>
                {current.status ?? "—"}
              </div>
            </div>
          </div>
        </div>


        {/* Context: Client / Quote / Description — surfaced near the top so you instantly know what this story is */}
        <div className="px-5 py-3 border-b border-rule space-y-2.5">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-0.5">Client</div>
            <div className="text-[13px] text-ink-strong">
              {current.clientNames.join(", ") || "—"}
            </div>
          </div>
          {current.payStatus.filter((p): p is string => typeof p === "string" && p.length > 0).length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-0.5">Pay Status</div>
              <div className="flex flex-wrap gap-1">
                {current.payStatus
                  .filter((p): p is string => typeof p === "string" && p.length > 0)
                  .map((p, i) => (
                    <span
                      key={`${p}-${i}`}
                      className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${payStatusTone(p)}`}
                    >
                      {p}
                    </span>
                  ))}
              </div>
            </div>
          )}
          {current.quoteIds.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-0.5">Epic (Proposal)</div>
              <div className="flex flex-col gap-0.5">
                {current.quoteIds.map((q, i) => (
                  <a
                    key={q}
                    href={`https://airvues-quote.vercel.app/?quoteId=${q}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald hover:underline text-[13px]"
                  >
                    {current.quoteLabels[i] ?? q} ↗
                  </a>
                ))}
              </div>
              {current.epicOwnerNames.length > 0 && (
                <div className="text-[11px] text-ink-muted mt-1">
                  Owner: <span className="text-ink-strong">{current.epicOwnerNames.join(", ")}</span>
                </div>
              )}
            </div>
          )}
          {current.description && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-0.5">Description</div>
              <div className="text-[12px] text-ink-muted whitespace-pre-wrap leading-snug max-h-48 overflow-y-auto">
                {current.description}
              </div>
            </div>
          )}
        </div>

        {pct != null && (
          <div className="px-5 py-4 border-b border-rule">
            <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1.5 font-mono tabnum">
              <span>{current.hoursWorked ?? 0}h worked / {current.hours}h scoped</span>
              <span className={over ? "text-red" : ""}>{pct}%{over ? " · over" : ""}</span>
            </div>
            <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${over ? "bg-red" : "bg-emerald"}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-b border-rule flex gap-2 flex-wrap">
          <a
            href={current.airtableUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-medium rounded hover:bg-emerald/80 transition-colors"
          >
            Open in Airtable ↗
          </a>
          {current.assigneeIds[0] && (
            <button
              type="button"
              onClick={() => onFilterByEngineer(current.assigneeIds[0])}
              className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
            >
              All for {current.assigneeNames[0]}
            </button>
          )}
          {current.clientNames[0] && (
            <button
              type="button"
              onClick={() => onFilterByClient(current.clientNames[0])}
              className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
            >
              All for {current.clientNames[0]}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `Duplicate "${current.name}" into the Next sprint?\n\nThe copy will be created with status Todo. You can split it later if needed.`,
                  )
                )
                  return;
                setError(null);
                startTransition(async () => {
                  const result = await duplicateStoryToNextSprint(story!.id);
                  if (!("ok" in result)) {
                    setError(result.error);
                  } else {
                    setSavedFlash(true);
                    setTimeout(() => setSavedFlash(false), 1500);
                    onDuplicated?.(result.id, result.sprintNumber);
                  }
                });
              }}
              className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-emerald hover:text-emerald transition-colors disabled:opacity-50"
            >
              Duplicate → Next sprint
            </button>
          )}
          {allowDelete && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Delete story "${current.name}"? This cannot be undone.`)) return;
                setError(null);
                startTransition(async () => {
                  const result = await deleteStory(story!.id);
                  if (!("ok" in result)) {
                    setError(result.error);
                  } else {
                    onDeleted?.(story!.id);
                    onClose();
                  }
                });
              }}
              className="px-3 py-1.5 text-[12px] bg-red/10 border border-red/40 text-red rounded hover:bg-red/20 transition-colors disabled:opacity-50"
            >
              Delete story
            </button>
          )}
        </div>

        <div className="px-5 py-2">
          {/* Editable Description */}
          {canEdit && (
            <Field label="Description">
              <textarea
                key={`desc-${current.id}`}
                defaultValue={current.description ?? ""}
                disabled={pending}
                rows={4}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val !== (current.description ?? "")) save({ description: val }, { description: val });
                }}
                className={`${inputCls} w-full resize-y`}
              />
            </Field>
          )}
          {/* Editable Comments */}
          <Field label="Comments" hint="Use to explain blockers or why a story is incomplete. Saves on blur.">
            {canEdit ? (
              <textarea
                key={`comments-${current.id}`}
                defaultValue={current.comments ?? ""}
                disabled={pending}
                rows={3}
                placeholder="Add a comment…"
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val !== (current.comments ?? "")) save({ comments: val }, { comments: val });
                }}
                className={`${inputCls} w-full resize-y`}
              />
            ) : current.comments ? (
              <div className="text-[12px] text-ink-muted whitespace-pre-wrap">{current.comments}</div>
            ) : (
              <span className="text-ink-faint">—</span>
            )}
          </Field>
          {/* Editable Status */}
          <Field label="Status">
            {canEdit ? (
              <select
                value={current.status ?? ""}
                onChange={(e) => save({ status: e.target.value }, { status: e.target.value })}
                disabled={pending}
                className={`${inputCls} w-full`}
              >
                <option value="">— pick —</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <span>{current.status ?? "—"}</span>
            )}
          </Field>

          {/* Editable Priority */}
          <Field label="Priority">
            {canEdit ? (
              <select
                value={current.priority ?? ""}
                onChange={(e) => save({ priority: e.target.value }, { priority: e.target.value })}
                disabled={pending}
                className={`${inputCls} w-full`}
              >
                <option value="">— none —</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <span>{current.priority ?? "—"}</span>
            )}
          </Field>

          {/* Editable Hours */}
          <Field label="Hours (scoped)">
            {canEdit ? (
              <input
                type="number"
                step="0.5"
                min="0"
                defaultValue={current.hours ?? ""}
                disabled={pending}
                onBlur={(e) => {
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  if (val !== current.hours) save({ hours: val }, { hours: val });
                }}
                className={`${inputCls} w-32`}
              />
            ) : (
              <span>{current.hours ?? "—"} h</span>
            )}
          </Field>

          {/* Editable Cost (Invoice) */}
          <Field label="Cost (USD)">
            {canEdit ? (
              <input
                key={`cost-${current.id}`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={current.cost ?? ""}
                disabled={pending}
                onBlur={(e) => {
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  if (val !== current.cost) save({ cost: val ?? 0 }, { invoice: val });
                }}
                className={`${inputCls} w-40`}
              />
            ) : (
              <span>{current.cost != null ? `$${current.cost.toLocaleString()}` : "—"}</span>
            )}
          </Field>



          {/* Editable Hours Worked */}
          <Field label="Hours worked">
            {canEdit ? (
              <input
                type="number"
                step="0.5"
                min="0"
                defaultValue={current.hoursWorked ?? ""}
                disabled={pending}
                onBlur={(e) => {
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  if (val !== current.hoursWorked) save({ hoursWorked: val }, { hoursWorked: val });
                }}
                className={`${inputCls} w-32`}
              />
            ) : (
              <span>{current.hoursWorked ?? 0} h</span>
            )}
          </Field>

          {/* Editable Assignees */}
          <Field
            label="Assignees"
            hint={canEdit && engineers.length > 0 ? "Click an engineer below to add or remove" : undefined}
          >
            {current.assigneeNames.length === 0 ? (
              <span className="text-red">Unassigned</span>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {current.assigneeNames.map((n, i) => {
                  const id = current.assigneeIds[i];
                  return (
                    <span
                      key={id ?? i}
                      className="px-2 py-0.5 text-[11px] bg-bg-elevated border border-rule rounded inline-flex items-center gap-1.5"
                    >
                      {n}
                      {canEdit && id && (
                        <button
                          type="button"
                          onClick={() => toggleAssignee(id)}
                          disabled={pending}
                          className="text-ink-faint hover:text-red text-[12px] leading-none"
                          aria-label={`Remove ${n}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {canEdit && engineers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {engineers
                  .filter((e) => !current.assigneeIds.includes(e.id))
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleAssignee(e.id)}
                      disabled={pending}
                      className="px-2 py-0.5 text-[10px] bg-bg-elevated border border-rule rounded text-ink-muted hover:text-emerald hover:border-emerald transition-colors"
                    >
                      + {e.name}
                    </button>
                  ))}
              </div>
            )}
          </Field>

          {/* Client shown in the top Context block */}
          <Field label="Sprint">
            {canEdit && sprints.length > 0 ? (
              <select
                value={current.sprintIds[0] ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const ids = id ? [id] : [];
                  const opt = sprints.find((s) => s.id === id);
                  save(
                    {
                      sprintIds: ids,
                      sprintNumbers: opt?.number != null ? [opt.number] : [],
                      sprintStatuses: opt?.status ? [opt.status] : [],
                    },
                    { sprintIds: ids },
                  );
                }}
                disabled={pending}
                className={`${inputCls} w-full`}
              >
                <option value="">— backlog (no sprint) —</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.number != null ? `Sprint #${s.number}` : "Sprint"}
                    {s.status ? ` · ${s.status}` : ""}
                  </option>
                ))}
              </select>
            ) : sprintNum != null ? (
              <span className="font-mono">
                #{sprintNum}
                {sprintStatus && <span className="text-ink-muted"> · {sprintStatus}</span>}
              </span>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Phase">
            {canEdit ? (
              <select
                value={current.phase ?? ""}
                onChange={(e) => save({ phase: e.target.value || null }, { phase: e.target.value || null })}
                disabled={pending}
                className={`${inputCls} w-full`}
              >
                <option value="">—</option>
                {PHASE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <span>{current.phase ?? "—"}</span>
            )}
          </Field>
          <Field label="Budget % Used">
            {current.budgetPctUsed != null ? (
              <span className={current.budgetPctUsed > 1 ? "text-red" : ""}>
                {(current.budgetPctUsed * 100).toFixed(1)}%
              </span>
            ) : (
              "—"
            )}
          </Field>
          {/* Description and Linked Quote shown in the top Context block */}
          <Field label="Airtable Record ID">
            <span className="font-mono text-[12px]">{current.id}</span>
          </Field>
        </div>
      </aside>
    </>,
    document.body,
  );
}
