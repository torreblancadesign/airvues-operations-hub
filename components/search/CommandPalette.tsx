"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import type { SearchItem } from "@/lib/search-index";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CachedIndex = { items: SearchItem[]; fetchedAt: number };
const CACHE_TTL_MS = 5 * 60 * 1000;
let memCache: CachedIndex | null = null;

const TYPE_LABEL: Record<SearchItem["type"], string> = {
  route: "Page",
  client: "Client",
  story: "Story",
  quote: "Quote",
  invoice: "Invoice",
  person: "Person",
};

const TYPE_ORDER: SearchItem["type"][] = [
  "route",
  "client",
  "story",
  "quote",
  "invoice",
  "person",
];

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<SearchItem[]>(memCache?.items ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const fresh = memCache && Date.now() - memCache.fetchedAt < CACHE_TTL_MS;
    if (fresh) {
      setItems(memCache!.items);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    fetch("/api/search")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { items: SearchItem[] }) => {
        memCache = { items: data.items, fetchedAt: Date.now() };
        setItems(data.items);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setLoading(false);
        fetchedRef.current = false;
      });
  }, [open]);

  const select = (href: string) => {
    onOpenChange(false);
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      router.push(href);
    }
  };

  const grouped: Record<SearchItem["type"], SearchItem[]> = {
    route: [],
    client: [],
    story: [],
    quote: [],
    invoice: [],
    person: [],
  };
  for (const it of items) grouped[it.type].push(it);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-[640px] bg-surface border border-rule rounded-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Global search"
          shouldFilter
          loop
          filter={(value, search) => {
            if (!search) return 1;
            const s = search.toLowerCase();
            return value.toLowerCase().includes(s) ? 1 : 0;
          }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-rule-soft">
            <span className="text-ink-faint text-[12px] font-mono uppercase tracking-wider">
              ⌘K
            </span>
            <Command.Input
              autoFocus
              placeholder="Search clients, stories, quotes, invoices, people…"
              className="flex-1 bg-transparent text-[14px] text-ink-strong placeholder:text-ink-faint outline-none"
            />
            <kbd className="text-[10px] font-mono text-ink-faint border border-rule-soft rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {loading && items.length === 0 && (
              <div className="px-3 py-6 text-center text-[12px] text-ink-faint">
                Loading index…
              </div>
            )}
            {error && (
              <div className="px-3 py-4 text-[12px] text-red">
                Failed to load: {error}
              </div>
            )}
            <Command.Empty className="px-3 py-6 text-center text-[12px] text-ink-faint">
              No matches.
            </Command.Empty>

            {TYPE_ORDER.map((type) => {
              const group = grouped[type];
              if (group.length === 0) return null;
              return (
                <Command.Group
                  key={type}
                  heading={TYPE_LABEL[type]}
                  className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-faint"
                >
                  {group.map((it) => (
                    <Command.Item
                      key={`${it.type}-${it.id}`}
                      value={`${it.title} ${it.keywords} ${it.subtitle ?? ""}`}
                      onSelect={() => select(it.href)}
                      className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-[13px] text-ink-muted data-[selected=true]:bg-bg data-[selected=true]:text-ink-strong"
                    >
                      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint shrink-0 w-14">
                        {TYPE_LABEL[it.type]}
                      </span>
                      <span className="flex-1 truncate">{it.title}</span>
                      {it.subtitle && (
                        <span className="text-[11px] text-ink-faint truncate max-w-[200px]">
                          {it.subtitle}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
