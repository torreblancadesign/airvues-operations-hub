"use client";

import { useCommandPalette } from "./CommandPaletteProvider";

export function SearchTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-rule-soft bg-bg/50 hover:bg-bg text-[12px] text-ink-muted hover:text-ink-strong transition-colors"
      aria-label="Open search (⌘K)"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline text-[10px] font-mono text-ink-faint border border-rule-soft rounded px-1 py-0.5 ml-1">
        ⌘K
      </kbd>
    </button>
  );
}
