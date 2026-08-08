// Shared portal presentation. One status vocabulary, one meter, one date
// format — so the same fact never renders two ways across the surface.
import type { RetainerRequest } from "@/lib/retainer-types";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "16 Aug" — pinned to en-US month names so a client's locale cannot
 *  render August as "ago", which is exactly what bit the ops app once. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

type Tone = "ok" | "warn" | "bad" | "info" | "quiet";

const TONE_STYLE: Record<Tone, { color: string; background: string }> = {
  ok: { color: "var(--p-ok)", background: "var(--p-ok-bg)" },
  warn: { color: "var(--p-warn)", background: "var(--p-warn-bg)" },
  bad: { color: "var(--p-bad)", background: "var(--p-bad-bg)" },
  info: { color: "var(--p-info)", background: "var(--p-info-bg)" },
  quiet: { color: "var(--p-ink-2)", background: "#f0f2f5" },
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="p-pill" style={TONE_STYLE[tone]}>
      {children}
    </span>
  );
}

/**
 * What a client should be told about a request, in their words.
 *
 * Deliberately not the raw Status. "Acknowledged" and "In Progress" are our
 * internal distinction; the client's question is only ever "has someone got
 * this, and did you answer when you said you would?".
 */
export function requestState(r: RetainerRequest): { tone: Tone; label: string } {
  if (r.status === "Declined") return { tone: "quiet", label: "Not taken on" };
  if (r.status === "Closed") return { tone: "quiet", label: "Closed" };
  if (r.status === "Delivered") return { tone: "ok", label: "Delivered" };
  if (r.status === "Awaiting Client") return { tone: "warn", label: "Needs your reply" };
  if (r.firstRespondedAt) return { tone: "info", label: "In progress" };
  if (r.slaOutcome === "Breached") return { tone: "bad", label: "Past our response time" };
  if (r.slaDueAt) return { tone: "info", label: "Awaiting our first reply" };
  return { tone: "quiet", label: "Received" };
}

/** A meter that always sits beside the number it describes, never alone. */
export function Meter({
  value,
  max,
  tone = "auto",
}: {
  value: number;
  max: number;
  tone?: "auto" | "quiet";
}) {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.min(100, Math.max(ratio * 100, value > 0 ? 2 : 0));
  const color =
    tone === "quiet"
      ? "var(--p-ink-3)"
      : ratio > 1
        ? "var(--p-bad)"
        : ratio >= 0.85
          ? "var(--p-warn)"
          : "var(--p-ok)";
  return (
    <div className="p-meter" role="presentation">
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="p-label">{children}</div>;
}
