"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { upload } from "@vercel/blob/client";
import { Lead, LeadAttachment, LeadStatus } from "@/lib/leads";
import type { Meeting } from "@/lib/meetings-types";
import { STATUS_PILL } from "./types";
import { attachLeadFiles, updateLeadStatus, updateLeadTranscript } from "@/lib/mutations/lead";
import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BATCH, UPLOAD_MAX_BYTES, sanitizeUploadFilename } from "@/lib/uploads";
import { JoinAndRecordButton } from "@/components/meetings/JoinAndRecordButton";
import { MeetingNotesPanel } from "@/components/meetings/MeetingNotesPanel";

type Props = {
  lead: Lead | null;
  onClose: () => void;
  canEdit?: boolean;
  meetings?: Meeting[];
};

const STATUS_CHOICES: LeadStatus[] = [
  "New Lead",
  "Needs Review",
  "In Proposal Stage",
  "Sold",
  "Not Sold",
];

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

function fmtBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-2.5 grid grid-cols-[140px_1fr] gap-3 border-b border-rule-soft last:border-0">
      <div className="text-[12px] text-ink-muted pt-0.5">{label}</div>
      <div className="text-[13px] text-ink whitespace-pre-wrap break-words">{children}</div>
    </div>
  );
}

function StatusEditor({
  leadId,
  current,
  canEdit,
}: {
  leadId: string;
  current: LeadStatus | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState<LeadStatus | "">(current ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(current ?? ""), [current, leadId]);

  if (!canEdit) {
    return current ? (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${STATUS_PILL[current]}`}>
        {current}
      </span>
    ) : <span className="text-ink-faint">—</span>;
  }

  const onChange = (next: LeadStatus) => {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await updateLeadStatus({ leadId, status: next });
      if ("error" in res) {
        setError(res.error);
        setValue(prev);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        disabled={isPending}
        className="bg-bg-elevated border border-rule rounded px-2 py-1 text-[12px] text-ink focus:outline-none focus:border-emerald disabled:opacity-50"
      >
        <option value="" disabled>— select —</option>
        {STATUS_CHOICES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {isPending && <span className="text-[11px] text-ink-faint">Saving…</span>}
      {error && <span className="text-[11px] text-red">{error}</span>}
    </div>
  );
}

function TranscriptEditor({
  leadId,
  current,
  canEdit,
}: {
  leadId: string;
  current: string | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(current ?? "");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setValue(current ?? ""); setEditing(false); }, [current, leadId]);

  if (!canEdit) {
    return current ? (
      <div className="text-[13px] text-ink whitespace-pre-wrap">{current}</div>
    ) : <span className="text-ink-faint text-[12px]">—</span>;
  }

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateLeadTranscript({ leadId, transcript: value });
      if ("error" in res) setError(res.error);
      else setEditing(false);
    });
  };

  if (!editing && current) {
    return (
      <div>
        <div className="text-[13px] text-ink whitespace-pre-wrap">{current}</div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1.5 text-[11px] text-emerald hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  if (!editing && !current) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-left px-3 py-2 bg-bg-elevated border border-dashed border-rule rounded text-[12px] text-ink-muted hover:border-ink-muted hover:text-ink"
      >
        Paste the meeting transcript here or any other meeting notes or email communication. Anything that is relevant as discovery for creating a proposal.
      </button>
    );
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        placeholder="Paste meeting transcript…"
        className="w-full bg-bg-elevated border border-rule rounded p-2 text-[13px] text-ink focus:outline-none focus:border-emerald font-mono"
        disabled={isPending}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="px-3 py-1.5 text-[12px] font-medium bg-emerald text-bg rounded hover:bg-emerald/80 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setValue(current ?? ""); setEditing(false); setError(null); }}
          disabled={isPending}
          className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted"
        >
          Cancel
        </button>
        {error && <span className="text-[11px] text-red">{error}</span>}
        <span className="ml-auto text-[10px] text-ink-faint font-mono">{value.length.toLocaleString()} chars</span>
      </div>
    </div>
  );
}

type UploadRow = {
  key: string;
  filename: string;
  status: "uploading" | "saving" | "error";
  error?: string;
};

function Attachments({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  // Local optimistic state: starts as the server-rendered list, mutated when uploads land.
  const [items, setItems] = useState<LeadAttachment[]>(lead.attachments);
  const [pending, setPending] = useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync when a different lead opens.
  useEffect(() => {
    setItems(lead.attachments);
    setPending([]);
    setGlobalError(null);
  }, [lead.id, lead.attachments]);

  const allowedSet = new Set<string>(UPLOAD_ALLOWED_MIME);

  const handleFiles = async (filesList: FileList | File[]) => {
    setGlobalError(null);
    const files = Array.from(filesList);
    if (files.length === 0) return;
    if (files.length > UPLOAD_MAX_BATCH) {
      setGlobalError(`Up to ${UPLOAD_MAX_BATCH} files per batch.`);
      return;
    }

    // Client-side validation
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const f of files) {
      if (f.size > UPLOAD_MAX_BYTES) {
        rejected.push(`${f.name} (too large, max ${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)} MB)`);
        continue;
      }
      if (f.type && !allowedSet.has(f.type)) {
        rejected.push(`${f.name} (type ${f.type} not allowed)`);
        continue;
      }
      accepted.push(f);
    }
    if (rejected.length > 0) {
      setGlobalError(`Rejected: ${rejected.join("; ")}`);
    }
    if (accepted.length === 0) return;

    const rows: UploadRow[] = accepted.map((f, i) => ({
      key: `${Date.now()}-${i}-${f.name}`,
      filename: f.name,
      status: "uploading",
    }));
    setPending((p) => [...p, ...rows]);

    // DIAGNOSTIC: monkey-patch fetch so we capture every request the @vercel/blob
    // SDK makes, even if the Network tab filters hide it. Remove once upload works.
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      // eslint-disable-next-line no-console
      console.log("[blob-diag] fetch start", method, url);
      try {
        const res = await origFetch(input as RequestInfo, init);
        // eslint-disable-next-line no-console
        console.log("[blob-diag] fetch end", res.status, res.headers.get("content-type"), url);
        // Clone + log small JSON bodies so we can see the token response shape.
        if (url.includes("/api/leads/upload") || url.includes("/api/quotes/upload")) {
          try {
            const clone = res.clone();
            const text = await clone.text();
            // eslint-disable-next-line no-console
            console.log("[blob-diag] upload-route body:", text.slice(0, 500));
          } catch {
            /* ignore */
          }
        }
        return res;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log("[blob-diag] fetch THREW", url, e);
        throw e;
      }
    };

    // Upload each to Vercel Blob in parallel.
    const uploaded: { url: string; filename: string; rowKey: string }[] = [];
    try {
      await Promise.all(
        accepted.map(async (file, i) => {
          const row = rows[i];
          try {
            const pathname = `leads/${lead.id}/${Date.now()}-${sanitizeUploadFilename(file.name)}`;
            // eslint-disable-next-line no-console
            console.log("[blob-diag] calling upload()", { pathname, leadId: lead.id, fileName: file.name, fileSize: file.size, fileType: file.type });
            const blob = await upload(pathname, file, {
              access: "public",
              handleUploadUrl: "/api/leads/upload",
              clientPayload: JSON.stringify({ leadId: lead.id }),
              contentType: file.type || undefined,
            });
            // eslint-disable-next-line no-console
            console.log("[blob-diag] upload() success", blob);
            uploaded.push({ url: blob.url, filename: file.name, rowKey: row.key });
            setPending((p) =>
              p.map((r) => (r.key === row.key ? { ...r, status: "saving" } : r)),
            );
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log("[blob-diag] upload() FAILED", e);
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
    } finally {
      window.fetch = origFetch;
    }


    if (uploaded.length === 0) return;

    // Persist all successful uploads to Airtable in a single call.
    const res = await attachLeadFiles({
      leadId: lead.id,
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

    setItems(res.attachments);
    setPending((p) => p.filter((r) => !uploaded.some((u) => u.rowKey === r.key)));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void handleFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && pending.length === 0 && !canEdit && (
        <div className="px-3 py-3 bg-bg-elevated border border-dashed border-rule rounded text-[12px] text-ink-faint text-center">
          No supporting documents attached.
        </div>
      )}

      {(items.length > 0 || pending.length > 0) && (
        <ul className="space-y-1.5">
          {items.map((a) => (
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
                r.status === "error"
                  ? "bg-red/5 border-red/40"
                  : "bg-bg-elevated border-rule"
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
        <>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`block cursor-pointer px-3 py-4 border border-dashed rounded text-[12px] text-center transition-colors ${
              dragOver
                ? "border-emerald bg-emerald/5 text-emerald"
                : "border-rule bg-bg-elevated text-ink-muted hover:border-ink-muted hover:text-ink"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={UPLOAD_ALLOWED_MIME.join(",")}
              onChange={onInputChange}
            />
            Drop files here or <span className="text-emerald underline">browse</span>
            <div className="mt-0.5 text-[10px] text-ink-faint">
              Up to {UPLOAD_MAX_BATCH} files · {(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)} MB each · PDF, images, Office docs, MP4
            </div>
          </label>
          {globalError && <div className="text-[11px] text-red">{globalError}</div>}
        </>
      )}
    </div>
  );
}

export function LeadSheet({ lead, onClose, canEdit = false }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!lead) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  if (!lead || !mounted) return null;

  const now = Date.now();
  const meetMs = lead.meetingDate ? new Date(lead.meetingDate).getTime() : null;
  const endMs = lead.endMeetingDate ? new Date(lead.endMeetingDate).getTime() : (meetMs ? meetMs + 30 * 60_000 : null);
  const isJoinable =
    !!lead.meetingLink && meetMs != null && endMs != null && now >= meetMs - 15 * 60_000 && now <= endMs + 5 * 60_000;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[560px] bg-surface z-50 border-l border-rule shadow-xl overflow-y-auto" role="dialog">

        <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">Lead</div>
            <h2 className="text-[16px] font-semibold text-ink-strong leading-tight truncate">{lead.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated shrink-0" aria-label="Close">×</button>
        </div>

        {/* Action buttons */}
        <div className="px-5 py-3 border-b border-rule flex gap-2 flex-wrap">
          {lead.meetingLink && (
            <JoinAndRecordButton
              meetingUrl={lead.meetingLink}
              leadId={lead.id}
              isJoinable={isJoinable}
              label={isJoinable ? "Join + record ↗" : "Open meeting link ↗"}
            />
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted">Email ↗</a>
          )}
          <a href={lead.airtableUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted">Airtable ↗</a>
        </div>

        {/* Lead Details (read-only — sourced from intake) */}
        <SectionHeader>Lead Details</SectionHeader>
        <div className="border-t border-rule">
          <Row label="Email">
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="text-emerald hover:underline">{lead.email}</a>
            ) : "—"}
          </Row>
          <Row label="Title">{lead.title ?? "—"}</Row>
          <Row label="Company Name">{lead.company ?? "—"}</Row>
          <Row label="Assessor">{lead.assessorName ?? <span className="text-ink-faint">—</span>}</Row>
          <Row label="Meeting Date">{fmtDateTime(lead.meetingDate)}</Row>
          <Row label="Meeting Link">
            {lead.meetingLink ? (
              <a href={lead.meetingLink} target="_blank" rel="noopener noreferrer" className="text-emerald hover:underline break-all">{lead.meetingLink}</a>
            ) : "—"}
          </Row>
          <Row label="Budget">
            {lead.budget ? (
              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-mono bg-violet-soft text-violet">{lead.budget}</span>
            ) : "—"}
          </Row>
          <Row label="What are you looking to build?">
            <span className="text-[13px]">{lead.whatToBuild ?? "—"}</span>
          </Row>
        </div>

        {/* Lead Assessment — editable */}
        <SectionHeader>
          Lead Assessment {canEdit ? <span className="ml-1 text-emerald normal-case font-normal">· editable</span> : <span className="ml-1 text-ink-faint normal-case font-normal">· read-only</span>}
        </SectionHeader>
        <div className="border-t border-rule">
          <Row label="Paste Meeting Transcript">
            <TranscriptEditor leadId={lead.id} current={lead.transcript} canEdit={canEdit} />
          </Row>
          <Row label="Attach Supporting Documentations">
            <Attachments lead={lead} canEdit={canEdit} />
          </Row>
          <Row label="Status">
            <StatusEditor leadId={lead.id} current={lead.status} canEdit={canEdit} />
            <div className="mt-1 text-[11px] text-ink-faint">
              Once all details have been entered above and lead is ready to move to proposal stage, update status to &quot;In Proposal Stage&quot;. If lead is not going to work out then move to &quot;Not Sold&quot;.
            </div>
          </Row>
        </div>

        {/* More context (operational extras not in Airtable interface) */}
        <SectionHeader>More Context</SectionHeader>
        <div className="border-t border-rule pb-6">
          <Row label="Source">{lead.source ?? "—"}</Row>
          <Row label="Created">{fmtDateTime(lead.createdTime)}</Row>

          {lead.quotesCount > 0 && (
            <Row label={`Linked Quotes (${lead.quotesCount})`}>
              {lead.quoteStatuses.length > 0 ? lead.quoteStatuses.join(" · ") : "—"}
            </Row>
          )}
          <Row label="Airtable Record ID">
            <span className="font-mono text-[11px] text-ink-muted">{lead.id}</span>
          </Row>
        </div>
      </aside>
    </>,
    document.body,
  );
}
