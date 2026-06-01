"use client";

import { useState } from "react";

export function CopyShareLink({ url, compact = false }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  if (compact) {
    return (
      <button
        onClick={onCopy}
        className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    );
  }
  return (
    <div className="flex items-stretch gap-0 border border-rule rounded-md overflow-hidden bg-surface/40">
      <input
        readOnly
        value={url}
        className="flex-1 bg-transparent px-3 py-2 text-[12px] font-mono text-ink-muted focus:outline-none"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        onClick={onCopy}
        className="px-3 py-2 bg-emerald/15 text-emerald text-[12px] font-medium hover:bg-emerald/25 transition"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
