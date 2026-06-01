"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Loop } from "@/lib/loops-types";

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type Option = { id: string; label: string };

function distinct(loops: Loop[], kind: "client" | "quote"): Option[] {
  const seen = new Map<string, string>();
  for (const l of loops) {
    const id = kind === "client" ? l.linkedClientId : l.linkedQuoteId;
    const name = kind === "client" ? l.linkedClientName : l.linkedQuoteName;
    if (id && !seen.has(id)) seen.set(id, name ?? "(unnamed)");
  }
  return Array.from(seen, ([id, label]) => ({ id, label })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

type Props = { loops: Loop[]; viewerOwnerId?: string | null };

export function LoopsBrowser({ loops, viewerOwnerId = null }: Props) {
  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("any");
  const [quoteFilter, setQuoteFilter] = useState<string>("any");
  const [ownerFilter, setOwnerFilter] = useState<string>("any");

  const clientOptions = useMemo(() => distinct(loops, "client"), [loops]);
  const quoteOptions = useMemo(() => distinct(loops, "quote"), [loops]);
  const ownerOptions = useMemo<Option[]>(() => {
    const seen = new Map<string, string>();
    for (const l of loops) {
      if (l.ownerId && !seen.has(l.ownerId)) {
        seen.set(l.ownerId, l.ownerName ?? "(unnamed)");
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [loops]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return loops.filter((l) => {
      if (needle) {
        const hay = `${l.title} ${l.ownerName ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (clientFilter === "untagged" && l.linkedClientId) return false;
      if (clientFilter !== "any" && clientFilter !== "untagged" && l.linkedClientId !== clientFilter)
        return false;
      if (quoteFilter === "untagged" && l.linkedQuoteId) return false;
      if (quoteFilter !== "any" && quoteFilter !== "untagged" && l.linkedQuoteId !== quoteFilter)
        return false;
      return true;
    });
  }, [loops, q, clientFilter, quoteFilter]);

  const hasFilter = q.length > 0 || clientFilter !== "any" || quoteFilter !== "any";

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-rule rounded-card p-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or owner…"
          className="flex-1 min-w-[180px] bg-surface/40 border border-rule rounded-md px-3 py-1.5 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
        />
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="bg-surface/40 border border-rule rounded-md px-2 py-1.5 text-[12px] text-ink-strong"
        >
          <option value="any">All clients</option>
          <option value="untagged">— No client —</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={quoteFilter}
          onChange={(e) => setQuoteFilter(e.target.value)}
          className="bg-surface/40 border border-rule rounded-md px-2 py-1.5 text-[12px] text-ink-strong"
        >
          <option value="any">All quotes</option>
          <option value="untagged">— No quote —</option>
          {quoteOptions.map((qo) => (
            <option key={qo.id} value={qo.id}>
              {qo.label}
            </option>
          ))}
        </select>
        {hasFilter && (
          <button
            onClick={() => {
              setQ("");
              setClientFilter("any");
              setQuoteFilter("any");
            }}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition px-2"
          >
            Clear
          </button>
        )}
        <span className="text-[11px] font-mono text-ink-faint ml-auto">
          Showing {filtered.length} of {loops.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-rule rounded-card p-8 text-center text-[13px] text-ink-muted">
          No recordings match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((loop) => (
            <Link
              key={loop.id}
              href={`/loops/${loop.id}`}
              className="group bg-surface border border-rule rounded-card overflow-hidden hover:border-emerald/40 transition"
            >
              <div className="aspect-video bg-black/40 relative">
                {loop.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={loop.posterUrl}
                    alt={loop.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-faint text-[12px] font-mono">
                    No preview
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                  {fmtDuration(loop.durationSec)}
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div className="text-[13px] font-medium text-ink-strong group-hover:text-emerald line-clamp-2">
                  {loop.title}
                </div>
                {(loop.linkedClientId || loop.linkedQuoteId) && (
                  <div className="flex flex-wrap gap-1.5">
                    {loop.linkedClientId && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald/10 border border-emerald/25 text-emerald max-w-full">
                        <span className="opacity-60">Client</span>
                        <span className="truncate normal-case tracking-normal">
                          {loop.linkedClientName ?? loop.linkedClientId}
                        </span>
                      </span>
                    )}
                    {loop.linkedQuoteId && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300 max-w-full">
                        <span className="opacity-60">Quote</span>
                        <span className="truncate normal-case tracking-normal">
                          {loop.linkedQuoteName ?? loop.linkedQuoteId}
                        </span>
                      </span>
                    )}
                  </div>
                )}
                <div className="text-[11px] font-mono text-ink-faint flex items-center justify-between">
                  <span>{loop.ownerName ?? "—"}</span>
                  <span>{new Date(loop.createdAt).toLocaleDateString()}</span>
                </div>
                {loop.viewCount > 0 && (
                  <div className="text-[10px] font-mono text-ink-faint">
                    {loop.viewCount} view{loop.viewCount === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
