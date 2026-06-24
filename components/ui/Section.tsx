"use client";

import { useLocalStorageBoolean } from "@/lib/use-local-storage";

type Tone = "emerald" | "sky" | "violet" | "amber" | "red" | "neutral";

const RAIL: Record<Tone, string> = {
  emerald: "before:bg-emerald",
  sky: "before:bg-sky",
  violet: "before:bg-violet",
  amber: "before:bg-amber",
  red: "before:bg-red",
  neutral: "before:bg-rule-strong",
};

const TITLE_DOT: Record<Tone, string> = {
  emerald: "bg-emerald",
  sky: "bg-sky",
  violet: "bg-violet",
  amber: "bg-amber",
  red: "bg-red",
  neutral: "bg-rule-strong",
};

type Props = {
  id?: string;
  title: string;
  tone?: Tone;
  meta?: React.ReactNode;
  /** When true (default), section can be collapsed by clicking the header. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Persists open/closed state in localStorage when provided. */
  storageKey?: string;
  /** Padding-less body when you embed a table directly. */
  bodyPadding?: boolean;
  children: React.ReactNode;
};

/**
 * Section — titled container with a colored left rail, eyebrow title, and
 * optional collapse-to-header behavior. Used to break dense pages into clearly
 * labeled, scannable zones.
 */
export function Section({
  id,
  title,
  tone = "neutral",
  meta,
  collapsible = true,
  defaultOpen = true,
  storageKey,
  bodyPadding = true,
  children,
}: Props) {
  const [open, setOpen] = useLocalStorageBoolean(
    storageKey ?? `__section:${id ?? title}`,
    defaultOpen,
  );
  const isOpen = collapsible ? open : true;

  return (
    <section
      id={id}
      className={`relative bg-surface border border-rule rounded-card overflow-hidden mb-4 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${RAIL[tone]}`}
    >
      <header
        onClick={collapsible ? () => setOpen(!isOpen) : undefined}
        className={`flex items-center justify-between gap-3 pl-5 pr-4 py-3 border-b border-rule ${
          collapsible ? "cursor-pointer hover:bg-bg-elevated transition-colors" : ""
        } ${!isOpen ? "border-b-0" : ""}`}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? isOpen : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full ${TITLE_DOT[tone]} shrink-0`} aria-hidden="true" />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-strong truncate">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {meta && <div className="text-[11px] text-ink-muted">{meta}</div>}
          {collapsible && (
            <span
              aria-hidden="true"
              className={`text-ink-muted text-[10px] font-mono transition-transform ${
                isOpen ? "rotate-0" : "-rotate-90"
              }`}
            >
              ▾
            </span>
          )}
        </div>
      </header>
      {isOpen && <div className={bodyPadding ? "p-4 sm:p-5" : ""}>{children}</div>}
    </section>
  );
}
