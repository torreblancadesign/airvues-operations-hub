"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import {
  loadQuoteDetail,
  loadStoryDetail,
  updateQuoteFields,
  attachQuoteDocuments,
  triggerAiProposalAgent,
} from "@/lib/mutations/quote";
import type { Story } from "@/lib/engineering-types";
import { StorySheet } from "@/components/engineering/StorySheet";
import type {
  PersonOption,
  QuoteAttachment,
  QuoteDetail,
  QuoteFieldPatch,
} from "@/lib/quote-types";
import {
  PROJECT_STATUS_CHOICES,
  PROPOSAL_TYPE_CHOICES,
} from "@/lib/quote-types";
import {
  UPLOAD_ALLOWED_MIME,
  UPLOAD_MAX_BATCH,
  UPLOAD_MAX_BYTES,
  sanitizeUploadFilename,
} from "@/lib/uploads";
import { PersonPicker } from "./PersonPicker";
import { QuoteStoriesTable } from "./QuoteStoriesTable";
import { NewQuoteStoryModal } from "./NewQuoteStoryModal";

type Props = {
  quoteId: string;
  initial?: QuoteDetail | null;
  people: PersonOption[];
  canEdit: boolean;
};

const inputCls =
  "w-full px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors disabled:opacity-50";
const selectCls = `${inputCls} cursor-pointer`;

// Defensive: Airtable rich-text / formula / rollup fields can return non-string
// values (e.g. { specialValue: "NaN" } from a broken formula). Coerce so
// downstream React renders + .trim() calls never throw and unmount the drawer.
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}


// (ClientVisibleChip removed — all client-facing fields now use PortalChip
// so the labeling is consistent with the AI proposal section.)


function InternalChip() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-amber bg-amber/10 border border-amber/30 px-1.5 py-0.5 rounded"
      title="Only the Airvues team sees this."
    >
      🔒 Internal only
    </span>
  );
}

function PortalChip() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-sky bg-sky/10 border border-sky/30 px-1.5 py-0.5 rounded"
      title="Visible on the client-facing portal."
    >
      🖥️ Portal visible
    </span>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error"; }) {
  if (state === "idle") return null;
  const map = {
    saving: { text: "Saving…", cls: "text-ink-faint" },
    saved: { text: "Saved", cls: "text-emerald" },
    error: { text: "Save failed", cls: "text-red" },
  } as const;
  const { text, cls } = map[state];
  return <span className={`text-[10px] font-mono ${cls}`}>{text}</span>;
}

function FieldRow({
  label,
  hint,
  chip,
  children,
  state,
}: {
  label: string;
  hint?: string;
  chip?: React.ReactNode;
  children: React.ReactNode;
  state?: "idle" | "saving" | "saved" | "error";
}) {
  return (
    <div className="px-5 py-3 border-b border-rule-soft last:border-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {label}
          </label>
          {chip}
        </div>
        <SaveIndicator state={state ?? "idle"} />
      </div>
      {hint && <div className="text-[11px] text-ink-faint mb-1.5">{hint}</div>}
      {children}
    </div>
  );
}

// Generic text field that autosaves on blur. Tracks its own dirty state so
// re-renders from parent (after quote refresh) don't fight the user's typing.
function TextField({
  initialValue,
  onSave,
  multiline = false,
  rows = 3,
  placeholder,
  disabled,
  fontMono = false,
}: {
  initialValue: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  fontMono?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const lastSaved = useRef(initialValue);

  useEffect(() => {
    // Adopt server value only if user isn't mid-edit.
    if (!pending && value === lastSaved.current) {
      setValue(initialValue);
      lastSaved.current = initialValue;
    }
  }, [initialValue, pending, value]);

  const commit = async () => {
    if (value === lastSaved.current) return;
    setPending(true);
    try {
      await onSave(value);
      lastSaved.current = value;
    } finally {
      setPending(false);
    }
  };

  const cls = `${inputCls} ${fontMono ? "font-mono" : ""}`;
  return multiline ? (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      disabled={disabled || pending}
      rows={rows}
      placeholder={placeholder}
      className={`${cls} resize-y`}
    />
  ) : (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      disabled={disabled || pending}
      placeholder={placeholder}
      className={cls}
    />
  );
}

// ---------- Attachments (Documents needed for Proposal) ----------

type UploadRow = { key: string; filename: string; status: "uploading" | "saving" | "error"; error?: string };

function fmtBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function QuoteAttachments({
  quoteId,
  attachments,
  setAttachments,
  canEdit,
}: {
  quoteId: string;
  attachments: QuoteAttachment[];
  setAttachments: (next: QuoteAttachment[]) => void;
  canEdit: boolean;
}) {
  const [pending, setPending] = useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const allowedSet = new Set<string>(UPLOAD_ALLOWED_MIME);

  const handleFiles = async (filesList: FileList | File[]) => {
    setGlobalError(null);
    const files = Array.from(filesList);
    if (files.length === 0) return;
    if (files.length > UPLOAD_MAX_BATCH) {
      setGlobalError(`Up to ${UPLOAD_MAX_BATCH} files per batch.`);
      return;
    }
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of files) {
      if (f.size > UPLOAD_MAX_BYTES) {
        rejected.push(`${f.name} (too large)`);
        continue;
      }
      if (f.type && !allowedSet.has(f.type)) {
        rejected.push(`${f.name} (type ${f.type} not allowed)`);
        continue;
      }
      accepted.push(f);
    }
    if (rejected.length) setGlobalError(`Rejected: ${rejected.join("; ")}`);
    if (accepted.length === 0) return;

    const rows: UploadRow[] = accepted.map((f, i) => ({
      key: `${Date.now()}-${i}-${f.name}`,
      filename: f.name,
      status: "uploading",
    }));
    setPending((p) => [...p, ...rows]);

    const uploaded: { url: string; filename: string; rowKey: string }[] = [];
    await Promise.all(
      accepted.map(async (file, i) => {
        const row = rows[i];
        try {
          const pathname = `quotes/${quoteId}/${Date.now()}-${sanitizeUploadFilename(file.name)}`;
          const blob = await upload(pathname, file, {
            access: "public",
            handleUploadUrl: "/api/quotes/upload",
            clientPayload: JSON.stringify({ quoteId }),
            contentType: file.type || undefined,
          });
          uploaded.push({ url: blob.url, filename: file.name, rowKey: row.key });
          setPending((p) =>
            p.map((r) => (r.key === row.key ? { ...r, status: "saving" } : r)),
          );
        } catch (e) {
          setPending((p) =>
            p.map((r) =>
              r.key === row.key
                ? { ...r, status: "error", error: (e as Error).message }
                : r,
            ),
          );
        }
      }),
    );

    if (uploaded.length === 0) return;

    const res = await attachQuoteDocuments({
      quoteId,
      files: uploaded.map(({ url, filename }) => ({ url, filename })),
    });

    if ("error" in res) {
      setGlobalError(res.error);
      setPending((p) =>
        p.map((r) =>
          uploaded.some((u) => u.rowKey === r.key)
            ? { ...r, status: "error", error: res.error }
            : r,
        ),
      );
      return;
    }
    setAttachments(res.attachments);
    setPending((p) => p.filter((r) => !uploaded.some((u) => u.rowKey === r.key)));
  };

  return (
    <div className="space-y-2">
      {(attachments.length > 0 || pending.length > 0) && (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-bg-elevated border border-rule rounded"
            >
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-emerald hover:underline truncate"
                title={a.filename}
              >
                📎 {a.filename}
              </a>
              <span className="text-[10px] font-mono text-ink-faint shrink-0">{fmtBytes(a.size)}</span>
            </li>
          ))}
          {pending.map((r) => (
            <li
              key={r.key}
              className={`flex items-center justify-between gap-2 px-3 py-2 border rounded ${
                r.status === "error" ? "bg-red/5 border-red/40" : "bg-bg-elevated border-rule"
              }`}
            >
              <span className="text-[12px] text-ink truncate" title={r.filename}>
                {r.status === "uploading" ? "⬆️" : r.status === "saving" ? "💾" : "⚠️"} {r.filename}
              </span>
              <span className="text-[10px] font-mono text-ink-faint shrink-0">
                {r.status === "uploading" && "uploading…"}
                {r.status === "saving" && "saving…"}
                {r.status === "error" && (r.error ?? "failed")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
          }}
          className={`block cursor-pointer px-3 py-4 border border-dashed rounded text-[12px] text-center transition-colors ${
            dragOver
              ? "border-emerald bg-emerald/5 text-emerald"
              : "border-rule bg-bg-elevated text-ink-muted hover:border-ink-muted hover:text-ink"
          }`}
        >
          <input
            type="file"
            multiple
            className="hidden"
            accept={UPLOAD_ALLOWED_MIME.join(",")}
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          Attach any documents from client (requirements, screenshots, etc.)
          <div className="mt-0.5 text-[10px] text-ink-faint">
            Up to {UPLOAD_MAX_BATCH} files · {(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)} MB each
          </div>
        </label>
      )}

      {!canEdit && attachments.length === 0 && (
        <div className="px-3 py-3 bg-bg-elevated border border-dashed border-rule rounded text-[12px] text-ink-faint text-center">
          No documents attached.
        </div>
      )}

      {globalError && <div className="text-[11px] text-red">{globalError}</div>}
    </div>
  );
}

// ---------- Editable AI field (read-only by default, click to edit) ----------

function AiField({
  value,
  onSave,
  canEdit,
  rows = 4,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  canEdit: boolean;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (!editing) {
    return (
      <div>
        {value ? (
          <div className="text-[13px] text-ink whitespace-pre-wrap break-words bg-bg-elevated border border-rule rounded p-2.5">
            {value}
          </div>
        ) : (
          <div className="text-[12px] text-ink-faint italic px-2.5 py-2 border border-dashed border-rule rounded">
            Not yet generated by the AI proposal agent.
          </div>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1.5 text-[11px] text-emerald hover:underline"
          >
            {value ? "Edit" : "Add manually"}
          </button>
        )}
      </div>
    );
  }

  const save = async () => {
    setErr(null);
    setPending(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={rows}
        disabled={pending}
        className={`${inputCls} resize-y`}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-medium rounded hover:bg-emerald/80 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(false);
            setErr(null);
          }}
          disabled={pending}
          className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted"
        >
          Cancel
        </button>
        {err && <span className="text-[11px] text-red">{err}</span>}
      </div>
    </div>
  );
}

// ---------- Section wrapper (collapsible support) ----------

function Section({
  title,
  chip,
  collapsible = false,
  defaultOpen = true,
  storageKey,
  children,
}: {
  title: string;
  chip?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  storageKey?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (!collapsible) return true;
    if (typeof window === "undefined" || !storageKey) return defaultOpen;
    const v = window.localStorage.getItem(storageKey);
    if (v === "open") return true;
    if (v === "closed") return false;
    return defaultOpen;
  });

  useEffect(() => {
    if (!collapsible || !storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, open ? "open" : "closed");
  }, [open, collapsible, storageKey]);

  return (
    <section className="border-t border-rule">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        disabled={!collapsible}
        className={`w-full flex items-center justify-between gap-2 px-5 py-3 ${
          collapsible ? "cursor-pointer hover:bg-bg-elevated/40" : "cursor-default"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-strong">
            {title}
          </h3>
          {chip}
        </div>
        {collapsible && (
          <span className="text-ink-faint text-[12px]">{open ? "▾" : "▸"}</span>
        )}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </section>
  );
}

// ---------- Create AI Proposal button row ----------

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function CreateAiProposalRow({
  canEdit,
  hasClientInput,
  aiContentReady,
  isAgentRunning,
  isTriggering,
  pollStartedAt,
  pollTick,
  error,
  onClick,
}: {
  canEdit: boolean;
  hasClientInput: boolean;
  aiContentReady: boolean;
  isAgentRunning: boolean;
  isTriggering: boolean;
  pollStartedAt: number | null;
  pollTick: number;
  error: string | null;
  onClick: () => void;
}) {
  // pollTick is read so React re-renders the elapsed counter every poll.
  void pollTick;

  const disabledReason = !canEdit
    ? "Read-only access"
    : !hasClientInput && !aiContentReady
      ? "Add a problem statement or attach documents first."
      : null;

  const label = isTriggering
    ? "Starting…"
    : isAgentRunning
      ? "Generating proposal…"
      : aiContentReady
        ? "Re-run AI Proposal"
        : "Create AI Proposal";

  const disabled = isTriggering || isAgentRunning || disabledReason !== null;

  return (
    <div className="px-5 py-4 border-t border-rule-soft bg-bg-elevated/40">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-ink-muted">
          {isAgentRunning ? (
            <>
              <span className="text-sky font-medium">Generating proposal…</span>{" "}
              <span className="text-ink-faint">
                usually 1–2 minutes
                {pollStartedAt ? ` · ${formatElapsed(Date.now() - pollStartedAt)} elapsed` : ""}
              </span>
            </>
          ) : aiContentReady ? (
            <span className="text-emerald">Proposal generated. Edits below override AI output.</span>
          ) : (
            "Once client input is captured, run the AI agent to draft the proposal + quote calculator."
          )}
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          title={disabledReason ?? undefined}
          className={`px-3.5 py-2 text-[12px] font-semibold rounded transition-colors inline-flex items-center gap-2 ${
            disabled
              ? "bg-bg-elevated text-ink-faint border border-rule cursor-not-allowed"
              : aiContentReady
                ? "bg-bg-elevated text-ink border border-rule hover:border-emerald hover:text-emerald"
                : "bg-emerald text-bg hover:bg-emerald/80"
          }`}
        >
          {isAgentRunning || isTriggering ? (
            <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : null}
          <span>{label}</span>
        </button>
      </div>
      {error ? (
        <div className="mt-2 text-[11px] text-red">⚠ {error}</div>
      ) : null}
    </div>
  );
}

// ---------- Main editor ----------


export function QuoteSheetEditor({ quoteId, initial, people, canEdit }: Props) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteDetail | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [showAddStory, setShowAddStory] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [lastSavedField, setLastSavedField] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);

  const openStory = (storyId: string) => {
    setStoryLoading(true);
    loadStoryDetail(storyId).then((res) => {
      setStoryLoading(false);
      if ("ok" in res) setSelectedStory(res.story);
    });
  };

  const closeStory = () => {
    setSelectedStory(null);
    // Re-fetch the quote so any edits to Hours/Cost/Status are reflected in the
    // calculator and the Total Cost rollup.
    loadQuoteDetail(quoteId).then((res) => {
      if ("ok" in res) setQuote(res.quote);
    });
    router.refresh();
  };

  // ---- AI proposal trigger + polling ----
  const [aiTriggering, setAiTriggering] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const isAgentRunning = quote?.runAiProposalAgent === true;

  // Poll every 10s while the agent is running. Auto-stops when checkbox flips
  // back to false (Airtable automation un-checks at completion) or after 5 min.
  useEffect(() => {
    if (!isAgentRunning) {
      setPollStartedAt(null);
      return;
    }
    if (pollStartedAt === null) setPollStartedAt(Date.now());
    const startedAt = pollStartedAt ?? Date.now();
    let alive = true;
    const tick = setInterval(() => {
      if (!alive) return;
      // 5 min safety cutoff
      if (Date.now() - startedAt > 5 * 60_000) {
        clearInterval(tick);
        return;
      }
      loadQuoteDetail(quoteId).then((res) => {
        if (!alive) return;
        if ("ok" in res) setQuote(res.quote);
        setPollTick((t) => t + 1);
      });
    }, 10_000);
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [isAgentRunning, quoteId, pollStartedAt]);

  const handleTriggerAi = async () => {
    setAiError(null);
    setAiTriggering(true);
    const res = await triggerAiProposalAgent(quoteId);
    setAiTriggering(false);
    if ("ok" in res) {
      setQuote(res.quote);
      setPollStartedAt(Date.now());
    } else {
      setAiError(res.error);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadErr(null);
    loadQuoteDetail(quoteId).then((res) => {
      if (!alive) return;
      if ("error" in res) setLoadErr(res.error);
      else setQuote(res.quote);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [quoteId]);

  if (loading && !quote) {
    return <div className="px-5 py-8 text-[12px] text-ink-faint">Loading quote details…</div>;
  }
  if (loadErr) {
    return (
      <div className="mx-5 my-4 bg-red/10 border border-red/30 rounded p-3 text-[12px] text-red">
        Failed to load quote: {loadErr}
      </div>
    );
  }
  if (!quote) return null;

  const patchAndRefresh = (
    fieldKey: string,
    patch: QuoteFieldPatch,
  ): Promise<void> =>
    new Promise((resolve) => {
      setSavingField(fieldKey);
      startTransition(async () => {
        const res = await updateQuoteFields(quoteId, patch);
        setSavingField(null);
        if ("ok" in res) {
          setQuote(res.quote);
          setLastSavedField(fieldKey);
          setTimeout(() => {
            setLastSavedField((curr) => (curr === fieldKey ? null : curr));
          }, 1500);
        }
        resolve();
      });
    });

  const stateFor = (k: string): "idle" | "saving" | "saved" | "error" => {
    if (savingField === k) return "saving";
    if (lastSavedField === k) return "saved";
    return "idle";
  };

  return (
    <>
      {/* SECTION 1: Quote details (client-visible header) */}
      <Section title="Quote details" chip={<PortalChip />}>
        <FieldRow label="Project name" chip={<PortalChip />} state={stateFor("projectName")}>
          <TextField
            initialValue={quote.projectName}
            disabled={!canEdit}
            onSave={(v) => patchAndRefresh("projectName", { projectName: v })}
            placeholder="Project name shown to the client"
          />
        </FieldRow>

        <FieldRow label="Prepared by" chip={<PortalChip />} state={stateFor("preparedById")}>
          <PersonPicker
            value={quote.preparedById}
            options={people}
            disabled={!canEdit}
            placeholder="Pick the Airvues lead"
            onChange={(id) => void patchAndRefresh("preparedById", { preparedById: id })}
          />
        </FieldRow>

        <FieldRow label="Prepared date" chip={<PortalChip />} state={stateFor("preparedDate")}>
          <input
            type="date"
            value={quote.preparedDate ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              void patchAndRefresh("preparedDate", { preparedDate: e.target.value || null })
            }
            className={`${inputCls} font-mono w-auto`}
          />
        </FieldRow>

        <FieldRow label="Prepared for" chip={<PortalChip />} state={stateFor("preparedForId")}>
          <PersonPicker
            value={quote.preparedForId}
            options={people}
            disabled={!canEdit}
            placeholder="Pick the client contact"
            onChange={(id) => void patchAndRefresh("preparedForId", { preparedForId: id })}
          />
        </FieldRow>

        <FieldRow label="Project status" chip={<PortalChip />} state={stateFor("projectStatus")}>
          <select
            value={quote.projectStatus ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              void patchAndRefresh("projectStatus", { projectStatus: e.target.value || null })
            }
            className={selectCls}
          >
            <option value="">— select —</option>
            {PROJECT_STATUS_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Proposal type" chip={<PortalChip />} state={stateFor("proposalType")}>
          <select
            value={quote.proposalType ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              void patchAndRefresh("proposalType", { proposalType: e.target.value || null })
            }
            className={selectCls}
          >
            <option value="">— select —</option>
            {PROPOSAL_TYPE_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FieldRow>
      </Section>

      {/* SECTION 2: Client input — collapsible, internal-only */}
      <Section
        title="Client input for proposal"
        chip={<InternalChip />}
        collapsible
        defaultOpen={false}
        storageKey={`quote:${quoteId}:clientInput`}
      >
        <FieldRow
          label="Custom Problem Statement and Solution Summary"
          hint="Paste all information from the client for proposal (meeting transcripts, emails, requirements, etc.)"
          chip={<InternalChip />}
          state={stateFor("customProblemStatement")}
        >
          <TextField
            initialValue={quote.customProblemStatement}
            disabled={!canEdit}
            multiline
            rows={8}
            placeholder="Paste meeting transcripts, emails, requirements…"
            onSave={(v) =>
              patchAndRefresh("customProblemStatement", { customProblemStatement: v })
            }
          />
        </FieldRow>

        <FieldRow
          label="Documents needed for Proposal"
          hint="Attach any documents from the client (requirements, screenshots, etc.)"
          chip={<InternalChip />}
        >
          <QuoteAttachments
            quoteId={quoteId}
            attachments={quote.documents}
            setAttachments={(next) => setQuote({ ...quote, documents: next })}
            canEdit={canEdit}
          />
        </FieldRow>

        <CreateAiProposalRow
          canEdit={canEdit}
          hasClientInput={
            asStr(quote.customProblemStatement).trim().length > 0 || quote.documents.length > 0
          }
          aiContentReady={
            asStr(quote.recommendedApproach).trim().length > 0 &&
            asStr(quote.recommendedApproachSummary).trim().length > 0 &&
            asStr(quote.projectOverview).trim().length > 0 &&
            asStr(quote.problemStatementSolution).trim().length > 0 &&
            asStr(quote.estimateHoursRange).trim().length > 0 &&
            asStr(quote.estimateCostRange).trim().length > 0 &&
            quote.stories.length > 0
          }

          isAgentRunning={isAgentRunning}
          isTriggering={aiTriggering}
          pollStartedAt={pollStartedAt}
          pollTick={pollTick}
          error={aiError}
          onClick={handleTriggerAi}
        />
      </Section>

      {/* SECTION 3: AI proposal output — client-visible */}
      <Section title="AI-generated proposal content" chip={<PortalChip />}>
        <div className="px-5 pb-3 text-[11px] text-ink-faint">
          Generated by the AI proposal agent. Edit only to override.
        </div>

        <FieldRow label="Recommended Approach" chip={<PortalChip />} state={stateFor("recommendedApproach")}>
          <AiField
            value={quote.recommendedApproach}
            canEdit={canEdit}
            rows={5}
            onSave={(v) => patchAndRefresh("recommendedApproach", { recommendedApproach: v })}
          />
        </FieldRow>

        <FieldRow
          label="Recommended Approach Summary"
          chip={<PortalChip />}
          state={stateFor("recommendedApproachSummary")}
        >
          <AiField
            value={quote.recommendedApproachSummary}
            canEdit={canEdit}
            rows={3}
            onSave={(v) =>
              patchAndRefresh("recommendedApproachSummary", { recommendedApproachSummary: v })
            }
          />
        </FieldRow>

        <FieldRow label="Project Overview" chip={<PortalChip />} state={stateFor("projectOverview")}>
          <AiField
            value={quote.projectOverview}
            canEdit={canEdit}
            rows={5}
            onSave={(v) => patchAndRefresh("projectOverview", { projectOverview: v })}
          />
        </FieldRow>

        <FieldRow
          label="Problem Statement & Our Solution"
          chip={<PortalChip />}
          state={stateFor("problemStatementSolution")}
        >
          <AiField
            value={quote.problemStatementSolution}
            canEdit={canEdit}
            rows={5}
            onSave={(v) =>
              patchAndRefresh("problemStatementSolution", { problemStatementSolution: v })
            }
          />
        </FieldRow>

        <FieldRow label="Estimate Hours Range" chip={<PortalChip />} state={stateFor("estimateHoursRange")}>
          <AiField
            value={quote.estimateHoursRange}
            canEdit={canEdit}
            rows={2}
            onSave={(v) => patchAndRefresh("estimateHoursRange", { estimateHoursRange: v })}
          />
        </FieldRow>

        <FieldRow label="Estimate Cost Range" chip={<PortalChip />} state={stateFor("estimateCostRange")}>
          <AiField
            value={quote.estimateCostRange}
            canEdit={canEdit}
            rows={2}
            onSave={(v) => patchAndRefresh("estimateCostRange", { estimateCostRange: v })}
          />
        </FieldRow>
      </Section>

      {/* SECTION 4: Quote calculator — stories table */}
      <Section title="Quote calculator">
        <div className="px-5 pb-4">
          <QuoteStoriesTable
            stories={quote.stories}
            totalCost={quote.totalCost}
            totalHours={quote.totalHours}
            canEdit={canEdit}
            onAddClick={() => setShowAddStory(true)}
            onRowClick={openStory}
          />
          {storyLoading && (
            <div className="mt-2 text-[11px] text-ink-faint">Loading story…</div>
          )}
        </div>
      </Section>

      <NewQuoteStoryModal
        open={showAddStory}
        quoteId={quoteId}
        onClose={() => setShowAddStory(false)}
        onCreated={(next) => setQuote(next)}
      />

      <StorySheet
        story={selectedStory}
        engineers={people.filter((p) => p.isInternal && p.isActive).map((p) => ({ id: p.id, name: p.name }))}
        canEdit={canEdit}
        onClose={closeStory}
        onDeleted={() => {
          loadQuoteDetail(quoteId).then((res) => {
            if ("ok" in res) setQuote(res.quote);
          });
        }}
        onFilterByEngineer={() => {}}
        onFilterByClient={() => {}}
      />
    </>
  );
}
