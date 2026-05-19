import Link from "next/link";
import { BoardItem, Urgency } from "@/lib/landing";

const URGENCY: Record<Urgency, { dot: string; text: string }> = {
  red: { dot: "bg-red", text: "text-red" },
  amber: { dot: "bg-amber", text: "text-amber" },
  emerald: { dot: "bg-emerald", text: "text-emerald" },
  sky: { dot: "bg-sky", text: "text-sky" },
  violet: { dot: "bg-violet", text: "text-violet" },
  neutral: { dot: "bg-ink-faint", text: "text-ink-muted" },
};

const KIND_LABEL: Record<BoardItem["kind"], string> = {
  quote: "QUO",
  invoice: "INV",
  sprint: "SPR",
  story: "STR",
  company: "CO",
  deploy: "DEP",
};

type Props = {
  title: string;
  subtitle: string;
  items: BoardItem[];
  tone: "departure" | "arrival";
  emptyText: string;
};

export function StationBoard({ title, subtitle, items, tone, emptyText }: Props) {
  const accent = tone === "departure" ? "border-amber/30" : "border-emerald/30";
  const headerAccent =
    tone === "departure"
      ? "bg-gradient-to-r from-amber/15 via-amber/5 to-transparent"
      : "bg-gradient-to-r from-emerald/15 via-emerald/5 to-transparent";

  return (
    <div className={`bg-surface border ${accent} rounded-card overflow-hidden`}>
      <div className={`px-5 py-3 border-b border-rule ${headerAccent}`}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-strong">
            ◆ {title}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint tabnum">
            {items.length} {items.length === 1 ? "entry" : "entries"}
          </div>
        </div>
        <div className="text-[11px] text-ink-muted mt-1">{subtitle}</div>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-10 text-center text-[12px] text-ink-faint font-mono">
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {items.map((it, idx) => {
            const u = URGENCY[it.urgency];
            const isExternal = it.href.startsWith("http");
            const num = String(idx + 1).padStart(2, "0");
            const content = (
              <div className="grid grid-cols-[28px_36px_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-bg-elevated transition-colors group">
                <span className="font-mono text-[10px] text-ink-faint tabnum">{num}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  {KIND_LABEL[it.kind]}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.dot}`} aria-hidden="true" />
                    <span className="text-[13px] text-ink-strong group-hover:text-emerald transition-colors truncate">
                      {it.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted truncate ml-3.5">{it.sub}</div>
                </div>
                <span className={`font-mono text-[12px] tabnum font-semibold shrink-0 ${u.text}`}>
                  {it.badge}
                </span>
              </div>
            );
            return (
              <li key={it.id}>
                {isExternal ? (
                  <a href={it.href} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                ) : (
                  <Link href={it.href} className="block">
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
