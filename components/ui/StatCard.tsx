import { ReactNode } from "react";

type Tone = "neutral" | "emerald" | "red" | "amber" | "sky" | "violet";

const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-ink-strong",
  emerald: "text-emerald",
  red: "text-red",
  amber: "text-amber",
  sky: "text-sky",
  violet: "text-violet",
};

type Props = {
  label: string;
  value: string;
  sub?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: Tone;
};

export function StatCard({ label, value, sub, active = false, onClick, tone = "neutral" }: Props) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`text-left bg-surface rounded-card border p-4 transition-all duration-200 min-h-[100px] w-full ${
        active
          ? "border-emerald ring-1 ring-emerald/30 shadow-[0_0_24px_-12px_rgba(34,211,168,0.4)]"
          : interactive
            ? "border-rule hover:border-emerald/40 hover:-translate-y-px hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5),0_0_18px_-8px_rgba(34,211,168,0.2)]"
            : "border-rule"
      } ${interactive ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="eyebrow mb-2">{label}</div>
      <div className={`text-[26px] font-semibold leading-none tabnum ${TONE_VALUE[tone]}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[11px] text-ink-muted leading-snug">{sub}</div>}
    </button>
  );
}
