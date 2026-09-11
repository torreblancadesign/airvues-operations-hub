"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRetainerComment } from "@/lib/mutations/retainer-request";
import type { RetainerComment } from "@/lib/retainer-types";

// Pinned to en-US, not the viewer's locale. SLA timestamps are contractual, and
// a Spanish-locale browser renders August as "ago", which reads as "ago" in an
// otherwise English UI. Explicit beats ambiguous here.
function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function RequestThread({
  requestId,
  comments,
  awaitingFirstResponse,
  canEdit,
}: {
  requestId: string;
  comments: RetainerComment[];
  awaitingFirstResponse: boolean;
  /** Read-only viewers must not get a live reply box. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // `pending` stays false for the whole await, so the button was live during
  // the write. A double-click here sends the CLIENT two copies of the same
  // reply — and the first one stamps First Responded At.
  const [busy, setBusy] = useState(false);
  const locked = busy || pending || !canEdit;

  async function post() {
    const text = body.trim();
    if (!text || locked) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await addRetainerComment({
        requestId,
        body: text,
        side: "Airvues",
        visibleToClient,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setBody("");
      if (res.stoppedClock) setNotice("First response recorded — SLA clock stopped.");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="eyebrow">Thread</div>

      {comments.length === 0 ? (
        <div className="text-[12px] text-ink-muted border border-dashed border-rule rounded-md px-3 py-4 text-center">
          No messages yet.
          {awaitingFirstResponse && " The SLA clock is still running."}
        </div>
      ) : (
        <ol className="space-y-2">
          {comments.map((c) => {
            const airvues = c.authorSide === "Airvues";
            const internal = airvues && !c.visibleToClient;
            return (
              <li
                key={c.id}
                className={`rounded-md border px-3 py-2.5 ${
                  internal
                    ? "border-amber/40 bg-amber/5"
                    : airvues
                      ? "border-emerald/30 bg-emerald/5"
                      : "border-rule bg-bg-elevated"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[11px] font-medium text-ink-strong">
                    {c.authorName ?? (airvues ? "Airvues" : "Client")}
                    <span className="text-ink-faint font-normal ml-1.5">
                      {airvues ? "· Airvues" : "· Client"}
                    </span>
                    {internal && (
                      <span className="ml-2 text-[9px] uppercase tracking-wider text-amber">
                        internal only
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-ink-faint font-mono">{when(c.createdAt)}</div>
                </div>
                <p className="text-[12px] text-ink whitespace-pre-wrap leading-relaxed">
                  {c.body}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="border border-rule rounded-md p-3 bg-bg-elevated space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={
            awaitingFirstResponse
              ? "Write the first response — this stops the SLA clock…"
              : "Reply…"
          }
          className="w-full px-2.5 py-2 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="text-[11px] text-ink-muted flex items-center gap-1.5 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={visibleToClient}
              onChange={(e) => setVisibleToClient(e.target.checked)}
              className="accent-emerald"
            />
            Visible to client
            {!visibleToClient && (
              <span className="text-amber ml-1">· internal note</span>
            )}
          </label>
          <button
            type="button"
            onClick={post}
            disabled={locked || body.trim() === ""}
            className="px-3 py-1.5 text-[12px] rounded-md bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {locked ? "Posting…" : "Post reply"}
          </button>
        </div>
        {error && <p className="text-[11px] text-red">{error}</p>}
        {notice && <p className="text-[11px] text-emerald">{notice}</p>}
      </div>
    </div>
  );
}
