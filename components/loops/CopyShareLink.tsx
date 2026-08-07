"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

type Variant = "full" | "overlay";
type State = "idle" | "ok" | "err";

export function CopyShareLink({ url, variant = "full" }: { url: string; variant?: Variant }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(url);
      setState("ok");
    } catch {
      // Blocked clipboard (insecure context, denied permission). Say so — the
      // full variant leaves the URL selectable as the manual fallback.
      setState("err");
    }
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={onCopy}
        aria-label={state === "ok" ? "Share link copied" : "Copy share link"}
        title={state === "ok" ? "Copied" : "Copy share link"}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/65 border backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 ${
          state === "ok"
            ? "text-emerald border-emerald/60"
            : "text-white border-white/15 hover:bg-black/85 hover:border-emerald/60 hover:text-emerald"
        }`}
      >
        {state === "ok" ? (
          <Check aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5" />
        ) : (
          <Link2 aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-stretch rounded-md border border-rule bg-bg/50 overflow-hidden focus-within:border-emerald/50">
        <input
          readOnly
          value={url}
          aria-label="Public share link"
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-[12px] font-mono text-ink-muted focus:outline-none"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={onCopy}
          className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald/70 ${
            state === "err" ? "bg-red/15 text-red" : "bg-emerald/15 text-emerald hover:bg-emerald/25"
          }`}
        >
          {state === "ok" ? (
            <Check aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5" />
          ) : (
            <Copy aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
          )}
          {state === "ok" ? "Copied" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="text-[11px] text-red empty:hidden">
        {state === "err"
          ? "Your browser blocked the clipboard — select the link above and copy it manually."
          : ""}
      </p>
    </div>
  );
}
