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
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-faint">
          Details
        </div>
        <div className="bg-gradient-to-b from-surface to-surface/60 border border-rule rounded-card p-5 sm:p-6 space-y-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quote walkthrough for Acme"
              maxLength={200}
              className="w-full bg-surface/40 border border-rule rounded-md px-3 py-2.5 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50 focus:ring-2 focus:ring-emerald/20 transition"
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
                className="w-full bg-surface/40 border border-rule rounded-md px-3 py-2.5 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50 focus:ring-2 focus:ring-emerald/20 transition"
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
                className="w-full bg-surface/40 border border-rule rounded-md px-3 py-2.5 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50 focus:ring-2 focus:ring-emerald/20 transition"
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
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-faint">
          Capture
        </div>
        <LoopRecorder
          title={title.trim() || "Untitled recording"}
          linkedClientId={clientId || null}
          linkedQuoteId={quoteId || null}
          ownerFirstName={ownerFirstName}
        />
      </section>
    </div>
  );
}
