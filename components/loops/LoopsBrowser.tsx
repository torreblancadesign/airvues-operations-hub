"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Play,
  Search,
  SearchX,
  TriangleAlert,
  Video,
  X,
} from "lucide-react";
import type { Loop } from "@/lib/loops-types";
import { formatLoopDuration, loopAnalysisState } from "@/lib/loops-types";
import { CopyShareLink } from "./CopyShareLink";
import { DownloadLoopButton } from "./DownloadLoopButton";

const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "longest", label: "Longest first" },
  { id: "views", label: "Most viewed" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

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

/** Native select in the project's chrome — keeps platform behavior, loses the platform look. */
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md border border-rule bg-bg/50 py-1.5 pl-2.5 pr-7 text-[12px] text-ink-strong transition-colors hover:border-rule-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
      />
    </div>
  );
}

function ActiveChip({ dimension, value, onClear }: { dimension: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald/30 bg-emerald/10 py-0.5 pl-2.5 pr-1 text-[11px] text-emerald">
      <span className="font-mono uppercase tracking-wider text-[10px] opacity-60">{dimension}</span>
      <span className="truncate">{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${dimension} filter`}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-emerald/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70"
      >
        <X aria-hidden="true" strokeWidth={2.25} className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

/** `dateLabel` is formatted on the server — see formatLoopDate for why. */
export type LoopCard = Loop & { dateLabel: string };

type Props = { loops: LoopCard[]; viewerOwnerId?: string | null; shareOrigin: string };

export function LoopsBrowser({ loops, viewerOwnerId = null, shareOrigin }: Props) {
  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("any");
  const [quoteFilter, setQuoteFilter] = useState<string>("any");
  const [ownerFilter, setOwnerFilter] = useState<string>("any");
  const [sort, setSort] = useState<SortId>("newest");

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
    const rows = loops.filter((l) => {
      if (needle) {
        const hay =
          `${l.title} ${l.ownerName ?? ""} ${l.linkedClientName ?? ""} ${l.linkedQuoteName ?? ""} ${l.summary ?? ""} ${l.keyNotes ?? ""} ${l.actionItems ?? ""} ${l.questions ?? ""} ${l.transcript ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (clientFilter === "untagged" && l.linkedClientId) return false;
      if (clientFilter !== "any" && clientFilter !== "untagged" && l.linkedClientId !== clientFilter)
        return false;
      if (quoteFilter === "untagged" && l.linkedQuoteId) return false;
      if (quoteFilter !== "any" && quoteFilter !== "untagged" && l.linkedQuoteId !== quoteFilter)
        return false;
      if (ownerFilter === "untagged" && l.ownerId) return false;
      if (ownerFilter !== "any" && ownerFilter !== "untagged" && l.ownerId !== ownerFilter)
        return false;
      return true;
    });

    return rows.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return +new Date(a.createdAt) - +new Date(b.createdAt);
        case "longest":
          return b.durationSec - a.durationSec;
        case "views":
          return b.viewCount - a.viewCount;
        default:
          return +new Date(b.createdAt) - +new Date(a.createdAt);
      }
    });
  }, [loops, q, clientFilter, quoteFilter, ownerFilter, sort]);

  const labelFor = (opts: Option[], id: string) => opts.find((o) => o.id === id)?.label ?? id;
  const chips: { dimension: string; value: string; onClear: () => void }[] = [];
  if (q.trim()) chips.push({ dimension: "Search", value: `“${q.trim()}”`, onClear: () => setQ("") });
  if (clientFilter !== "any")
    chips.push({
      dimension: "Client",
      value: clientFilter === "untagged" ? "None" : labelFor(clientOptions, clientFilter),
      onClear: () => setClientFilter("any"),
    });
  if (quoteFilter !== "any")
    chips.push({
      dimension: "Quote",
      value: quoteFilter === "untagged" ? "None" : labelFor(quoteOptions, quoteFilter),
      onClear: () => setQuoteFilter("any"),
    });
  if (ownerFilter !== "any")
    chips.push({
      dimension: "By",
      value:
        ownerFilter === "untagged"
          ? "Unknown"
          : ownerFilter === viewerOwnerId
            ? "You"
            : labelFor(ownerOptions, ownerFilter),
      onClear: () => setOwnerFilter("any"),
    });

  const clearAll = () => {
    setQ("");
    setClientFilter("any");
    setQuoteFilter("any");
    setOwnerFilter("any");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-rule bg-surface p-3 space-y-2.5">
        <div className="relative">
          <Search
            aria-hidden="true"
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search recordings"
            placeholder="Search titles, summaries, transcripts…"
            className="w-full rounded-md border border-rule bg-bg/50 py-2 pl-9 pr-9 text-[13px] text-ink-strong placeholder:text-ink-faint transition-colors hover:border-rule-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-ink-faint transition-colors hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70"
            >
              <X aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
          <FilterSelect label="Filter by client" value={clientFilter} onChange={setClientFilter}>
            <option value="any">All clients</option>
            <option value="untagged">— No client —</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Filter by quote" value={quoteFilter} onChange={setQuoteFilter}>
            <option value="any">All quotes</option>
            <option value="untagged">— No quote —</option>
            {quoteOptions.map((qo) => (
              <option key={qo.id} value={qo.id}>
                {qo.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Filter by creator" value={ownerFilter} onChange={setOwnerFilter}>
            <option value="any">All creators</option>
            <option value="untagged">— Unknown —</option>
            {viewerOwnerId && ownerOptions.some((o) => o.id === viewerOwnerId) && (
              <option value={viewerOwnerId}>Just mine</option>
            )}
            {ownerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Sort recordings" value={sort} onChange={(v) => setSort(v as SortId)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </FilterSelect>

          <p className="col-span-2 font-mono tabnum text-[11px] text-ink-faint sm:col-span-4 lg:col-auto lg:ml-auto lg:pl-2">
            <span aria-live="polite">
              {filtered.length === loops.length
                ? `${loops.length} recording${loops.length === 1 ? "" : "s"}`
                : `${filtered.length} of ${loops.length}`}
            </span>
          </p>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-rule-soft pt-2.5">
            {chips.map((c) => (
              <ActiveChip key={c.dimension} {...c} />
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="rounded px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-faint transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-rule bg-surface px-6 py-14 text-center">
          <SearchX
            aria-hidden="true"
            strokeWidth={1.25}
            className="mx-auto h-8 w-8 text-ink-faint"
          />
          <p className="mt-4 text-[14px] text-ink-strong">No recordings match these filters.</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {loops.length} recording{loops.length === 1 ? "" : "s"} exist — widen the search to find
            them.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-emerald/30 bg-emerald/15 px-4 py-2 text-[13px] font-medium text-emerald transition-colors hover:bg-emerald/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <X aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5" />
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((loop) => {
            const isMine = !!viewerOwnerId && loop.ownerId === viewerOwnerId;
            const analysis = loopAnalysisState(loop);
            return (
              <li key={loop.id}>
                <article
                  className={`group relative flex h-full flex-col overflow-hidden rounded-card border bg-surface shadow-card transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.85)] motion-reduce:transform-none motion-reduce:transition-none ${
                    isMine ? "border-emerald/30 hover:border-emerald/60" : "border-rule hover:border-rule-strong"
                  }`}
                >
                  <div className="relative aspect-video overflow-hidden bg-black/50">
                    {loop.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={loop.posterUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-faint">
                        <Video aria-hidden="true" strokeWidth={1.25} className="h-6 w-6" />
                        <span className="font-mono text-[10px] uppercase tracking-wider">
                          No preview
                        </span>
                      </div>
                    )}

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                    />

                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="hover-reveal grid h-12 w-12 scale-90 place-items-center rounded-full bg-black/55 ring-1 ring-white/25 backdrop-blur-sm transition-transform duration-200 ease-out group-hover:scale-100 motion-reduce:transition-none motion-reduce:transform-none">
                        <Play
                          fill="currentColor"
                          strokeWidth={0}
                          className="h-4 w-4 translate-x-px text-white"
                        />
                      </span>
                    </div>

                    {analysis !== "ready" && (
                      <span
                        className={`absolute left-2 top-2 inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider backdrop-blur-sm ${
                          analysis === "pending"
                            ? "border-emerald/40 bg-black/65 text-emerald"
                            : "border-amber/40 bg-black/65 text-amber"
                        }`}
                      >
                        {analysis === "pending" ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald motion-safe:animate-pulse" />
                            Analyzing
                          </>
                        ) : (
                          <>
                            <TriangleAlert aria-hidden="true" strokeWidth={2} className="h-3 w-3" />
                            No summary
                          </>
                        )}
                      </span>
                    )}

                    <div className="hover-reveal absolute right-2 top-2 z-10 flex items-center gap-1">
                      <CopyShareLink url={`${shareOrigin}/r/${loop.shareToken}`} variant="overlay" />
                      <DownloadLoopButton
                        videoUrl={loop.videoUrl}
                        title={loop.title}
                        variant="overlay"
                      />
                    </div>

                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono tabnum text-[10px] text-white">
                      {formatLoopDuration(loop.durationSec)}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <h3 className="text-[13px] font-medium leading-snug text-ink-strong">
                      <Link
                        href={`/loops/${loop.id}`}
                        className="line-clamp-2 outline-none transition-colors after:absolute after:inset-0 after:rounded-card after:content-[''] group-hover:text-emerald focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-emerald"
                      >
                        {loop.title}
                      </Link>
                    </h3>

                    {(loop.linkedClientId || loop.linkedQuoteId) && (
                      <div className="flex flex-wrap gap-1.5">
                        {loop.linkedClientId && (
                          <span className="inline-flex max-w-full items-center gap-1 rounded border border-emerald/25 bg-emerald/10 px-1.5 py-0.5 text-[10px] text-emerald">
                            <span className="font-mono uppercase tracking-wider opacity-60">
                              Client
                            </span>
                            <span className="truncate">
                              {loop.linkedClientName ?? loop.linkedClientId}
                            </span>
                          </span>
                        )}
                        {loop.linkedQuoteId && (
                          <span className="inline-flex max-w-full items-center gap-1 rounded border border-sky/25 bg-sky/10 px-1.5 py-0.5 text-[10px] text-sky">
                            <span className="font-mono uppercase tracking-wider opacity-60">
                              Quote
                            </span>
                            <span className="truncate">
                              {loop.linkedQuoteName ?? loop.linkedQuoteId}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-auto flex items-baseline justify-between gap-2 pt-0.5 font-mono text-[11px] text-ink-faint">
                      <span className="truncate">
                        <span className={isMine ? "text-emerald" : "text-ink-muted"}>
                          {isMine ? "You" : (loop.ownerName ?? "Unknown")}
                        </span>
                        <span className="mx-1.5 opacity-50">·</span>
                        <span className="tabnum">{loop.dateLabel}</span>
                      </span>
                      {loop.viewCount > 0 && (
                        <span className="tabnum shrink-0">
                          {loop.viewCount} view{loop.viewCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
