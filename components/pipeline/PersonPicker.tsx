"use client";

import { useMemo, useState } from "react";
import type { PersonOption } from "@/lib/quote-types";

type Props = {
  value: string | null;
  options: PersonOption[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

// Lightweight searchable single-select for linked-record fields (Prepared by /
// Prepared for). Keeps the surface area small: input filters the dropdown,
// click commits, blur closes.
export function PersonPicker({ value, options, onChange, disabled, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter(
        (o) =>
          (o.name ?? "").toLowerCase().includes(q) ||
          (o.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [options, query]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule rounded-md text-ink hover:border-ink-muted focus:border-emerald focus:outline-none disabled:opacity-50"
      >
        <span className={selected ? "text-ink" : "text-ink-faint"}>
          {selected ? (selected.name || "(no name)") : placeholder ?? "— select —"}
        </span>
        <span className="text-ink-faint text-[10px]">▾</span>
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full bg-surface border border-rule rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border-b border-rule text-ink focus:outline-none"
            />
            <div className="overflow-y-auto">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="block w-full text-left px-2.5 py-1.5 text-[11px] text-red hover:bg-bg-elevated"
                >
                  Clear selection
                </button>
              )}
              {filtered.length === 0 && (
                <div className="px-2.5 py-3 text-[11px] text-ink-faint">No matches.</div>
              )}
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`block w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-bg-elevated ${
                    o.id === value ? "bg-emerald/10 text-emerald" : "text-ink"
                  }`}
                >
                  <div className="truncate">{o.name}</div>
                  {o.email && (
                    <div className="text-[10px] text-ink-faint truncate font-mono">{o.email}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
