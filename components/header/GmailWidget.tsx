"use client";

import { useEffect, useRef, useState } from "react";
import type { InboxResult } from "@/lib/gmail";

type Props = {
  result: InboxResult;
  compact?: boolean;
};

export function GmailWidget({ result, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chipLabel = (() => {
    if (result.kind === "no-token") return "Inbox";
    if (result.kind === "error") return "Inbox";
    if (result.unreadCount === 0) return "Inbox clear";
    return `${result.unreadCount} unread`;
  })();

  const showCountBadge = result.kind === "ok" && result.unreadCount > 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Recent inbox messages"
        className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-rule bg-surface hover:border-emerald/40 hover:bg-bg-elevated transition-all text-[12px]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink-muted"
          aria-hidden="true"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <span className={compact ? "hidden" : "text-ink-strong"}>{chipLabel}</span>
        {showCountBadge && (
          <span
            className="ml-0.5 px-1.5 h-4 inline-flex items-center justify-center rounded-full bg-emerald text-bg text-[10px] font-semibold tabnum"
            aria-hidden="true"
          >
            {result.unreadCount > 99 ? "99+" : result.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[380px] bg-surface border border-rule rounded-card shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200"
          role="dialog"
        >
          <div className="px-4 py-3 border-b border-rule bg-bg-elevated flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-strong">
              ◆ Inbox
            </div>
            <a
              href="https://mail.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-emerald hover:underline"
            >
              Open Gmail ↗
            </a>
          </div>

          {result.kind === "no-token" && (
            <div className="px-4 py-6 text-center">
              <div className="text-[13px] text-ink-strong mb-2">Gmail not connected</div>
              <p className="text-[12px] text-ink-muted mb-3 leading-snug">
                Sign out and sign in again to grant access to your Gmail inbox.
              </p>
              <a
                href="/api/auth/signout"
                className="inline-block px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors"
              >
                Sign out to reconnect
              </a>
            </div>
          )}

          {result.kind === "error" && (
            <div className="px-4 py-6 text-center text-[12px] text-red">
              Gmail API error: {result.message}
            </div>
          )}

          {result.kind === "ok" && result.messages.length === 0 && (
            <div className="px-4 py-10 text-center text-[12px] text-ink-faint font-mono">
              Inbox zero. Nothing unread.
            </div>
          )}

          {result.kind === "ok" && result.messages.length > 0 && (
            <ul className="divide-y divide-rule max-h-[460px] overflow-y-auto">
              {result.messages.map((m) => (
                <li key={m.id}>
                  <a
                    href={m.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 hover:bg-bg-elevated transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" aria-hidden="true" />
                          <span className="text-[12px] font-semibold text-ink-strong truncate">
                            {m.fromName}
                          </span>
                        </div>
                        <div className="text-[12px] text-ink truncate group-hover:text-emerald transition-colors ml-3.5">
                          {m.subject}
                        </div>
                        <div className="text-[11px] text-ink-muted leading-snug mt-0.5 line-clamp-1 ml-3.5">
                          {m.snippet}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-ink-faint tabnum shrink-0">
                        {m.ageLabel}
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
