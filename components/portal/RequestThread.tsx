"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPortalComment } from "@/lib/mutations/portal-request";
import type { RetainerComment } from "@/lib/retainer-types";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function stamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
}

export function PortalThread({
  requestId,
  comments,
  closed,
}: {
  requestId: string;
  comments: RetainerComment[];
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const locked = busy || pending;

  async function send() {
    if (locked || body.trim() === "") return;
    setError(null);
    setBusy(true);
    try {
      const res = await addPortalComment(requestId, body);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setBody("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <h2 className="t-h2">Conversation</h2>

      {comments.length === 0 ? (
        <p className="t-body mt-2">
          No messages yet. Anything you add here goes straight to the team working on this.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {comments.map((c) => {
            const mine = c.authorSide === "Client";
            return (
              <li
                key={c.id}
                className="p-panel p-4"
                style={{
                  background: mine ? "var(--p-sunk)" : "var(--p-panel)",
                  marginLeft: mine ? "auto" : undefined,
                  maxWidth: "min(100%, 620px)",
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>
                    {mine ? (c.authorName ?? "You") : (c.authorName ?? "Airvues")}
                  </span>
                  <span className="fig t-fine">
                    {stamp(c.createdAt)}
                  </span>
                </div>
                <p
                  className="mt-1.5"
                  style={{
                    fontSize: "var(--t-base)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {c.body}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-5">
        {error && (
          <p className="t-small mb-2" style={{ color: "var(--p-bad)" }}>{error}</p>
        )}
        <textarea
          className="p-input"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={closed ? "Add a follow-up — this will reopen the request" : "Add a message…"}
          style={{ resize: "vertical", lineHeight: 1.6 }}
        />
        <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
          <p className="t-fine">
            {closed
              ? "Replying reopens this request so it is not missed."
              : "Your reply does not restart the response clock."}
          </p>
          <button
            onClick={send}
            disabled={locked || body.trim() === ""}
            className="p-btn p-btn-primary"
          >
            {locked ? "Sending…" : "Send message"}
          </button>
        </div>
      </div>
    </section>
  );
}
