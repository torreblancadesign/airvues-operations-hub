"use client";

import { useState, useTransition } from "react";
import { updateLoopLinks } from "@/lib/mutations/loop";

type Option = { id: string; label: string };

type Props = {
  loopId: string;
  initialClientId: string | null;
  initialQuoteId: string | null;
  clients: Option[];
  quotes: Option[];
};

export function LoopTagsEditor({
  loopId,
  initialClientId,
  initialQuoteId,
  clients,
  quotes,
}: Props) {
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [quoteId, setQuoteId] = useState(initialQuoteId ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    (clientId || null) !== initialClientId || (quoteId || null) !== initialQuoteId;

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateLoopLinks(loopId, {
        linkedClientId: clientId || null,
        linkedQuoteId: quoteId || null,
      });
      if ("error" in res) {
        setMsg({ kind: "err", text: res.error });
      } else {
        setMsg({ kind: "ok", text: "Saved" });
      }
    });
  };

  return (
    <div className="bg-surface border border-rule rounded-card p-4 space-y-3">
      <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
        Tags
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
            Client
          </span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={pending}
            className="w-full bg-surface/40 border border-rule rounded-md px-2 py-1.5 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
          >
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
            Quote
          </span>
          <select
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
            disabled={pending}
            className="w-full bg-surface/40 border border-rule rounded-md px-2 py-1.5 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
          >
            <option value="">— None —</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="px-3 py-1.5 rounded-md bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/20 text-[12px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save tags"}
        </button>
        {msg && (
          <span
            className={`text-[11px] font-mono ${
              msg.kind === "ok" ? "text-emerald" : "text-red"
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
