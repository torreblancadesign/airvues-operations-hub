import Link from "next/link";

export type RetainerTab = "board" | "plans";

/** Parse the ?tab= param. Anything unrecognised falls back to the board. */
export function parseTab(value: string | undefined): RetainerTab {
  return value === "plans" ? "plans" : "board";
}

// URL-driven rather than client state, so the tab survives a refresh, can be
// linked to, and the back button behaves. Plain links — no JS needed.
export function RetainerTabs({ active, planCount }: { active: RetainerTab; planCount: number }) {
  const tabs: { id: RetainerTab; href: string; label: string; count?: number }[] = [
    { id: "board", href: "/retainers", label: "Retainers" },
    { id: "plans", href: "/retainers?tab=plans", label: "Plans", count: planCount },
  ];

  return (
    <nav className="flex items-center gap-1 border-b border-rule mb-5 -mt-2" aria-label="Retainer views">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`relative px-3 py-2 text-[13px] transition-colors ${
              on
                ? "text-ink-strong font-medium"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 text-[11px] text-ink-faint tabnum">{t.count}</span>
            )}
            {on && (
              <span
                className="absolute left-0 right-0 -bottom-px h-px bg-emerald"
                aria-hidden="true"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
