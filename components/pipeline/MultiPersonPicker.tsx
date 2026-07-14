"use client";

import { useMemo, useState } from "react";
import type { PersonOption } from "@/lib/quote-types";

type Props = {
  values: string[];
  options: PersonOption[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

// Multi-select variant of PersonPicker. Selected people render as removable
// chips; the dropdown filters out already-selected entries.
export function MultiPersonPicker({ values, options, onChange, disabled, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => values.map((id) => options.find((o) => o.id === id)).filter((o): o is PersonOption => !!o),
    [options, values],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedSet = new Set(values);
    const pool = options.filter((o) => !selectedSet.has(o.id));
    if (!q) return pool.slice(0, 50);
    return pool
      .filter(
        (o) =>
          (o.name ?? "").toLowerCase().includes(q) ||
          (o.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [options, values, query]);

  const add = (id: string) => {
    if (values.includes(id)) return;
    onChange([...values, id]);
    setQuery("");
  };

  const remove = (id: string) => {
    onChange(values.filter((v) => v !== id));
  };

  return (
    <div className="relative">
      <div className="w-full flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-bg-elevated border border-rule rounded-md min-h-[32px]">
        {selected.length === 0 && (
          <span className="text-[12px] text-ink-faint px-0.5">
            {placeholder ?? "— select —"}
          </span>
        )}
        {selected.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface border border-rule rounded text-[11px] text-ink"
          >
            <span className="truncate max-w-[160px]">{p.name || "(no name)"}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-ink-faint hover:text-red text-[10px] leading-none"
                aria-label={`Remove ${p.name}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-[11px] text-emerald hover:underline px-1"
          >
            + Add
          </button>
        )}
      </div>

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
              {filtered.length === 0 && (
                <div className="px-2.5 py-3 text-[11px] text-ink-faint">No matches.</div>
              )}
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => add(o.id)}
                  className="block w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-bg-elevated text-ink"
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
