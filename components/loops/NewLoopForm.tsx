"use client";

import { useState } from "react";
import { LoopRecorder } from "./LoopRecorder";

type Option = { id: string; label: string };

type Props = {
  clients: Option[];
  quotes: Option[];
  ownerFirstName: string | null;
};

export function NewLoopForm({ clients, quotes, ownerFirstName }: Props) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [quoteId, setQuoteId] = useState<string>("");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Quote walkthrough for Acme"
          maxLength={200}
          className="w-full bg-surface/40 border border-rule rounded-md px-3 py-2 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-surface/40 border border-rule rounded-md px-3 py-2 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
          >
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
            Quote
          </label>
          <select
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
            className="w-full bg-surface/40 border border-rule rounded-md px-3 py-2 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
          >
            <option value="">— None —</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <LoopRecorder
        title={title.trim() || "Untitled recording"}
        linkedClientId={clientId || null}
        linkedQuoteId={quoteId || null}
        ownerFirstName={ownerFirstName}
      />
    </div>
  );
}
