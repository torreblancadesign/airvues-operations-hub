"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string };

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  options: Option[];
  allLabel: string; // e.g. "All engineers" — shown when nothing selected, and as the clear row
  className?: string;
};

// Dropdown with a type-to-filter input — for filters whose option lists are
// too long to scan in a native <select> (engineers, clients).
export function SearchableSelect({ value, onChange, options, allLabel, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label ?? value
    : allLabel;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Focus after the dropdown mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`px-2.5 py-1.5 text-[12px] bg-surface border border-rule rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer flex items-center gap-1.5 max-w-[200px] ${
          value ? "text-ink" : "text-ink-muted"
        }`}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          className={`w-3 h-3 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-60 rounded-md border border-rule bg-surface shadow-xl shadow-black/40">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (visible[0]) pick(visible[0].value);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Type to search..."
            className="w-full bg-transparent border-b border-rule px-3 py-2 text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => pick(null)}
              className={`block w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-elevated transition-colors ${
                value === null ? "text-emerald" : "text-ink-muted"
              }`}
            >
              {allLabel}
            </button>
            {visible.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className={`block w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-elevated transition-colors truncate ${
                  o.value === value ? "text-emerald" : "text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
            {visible.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-ink-faint">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
