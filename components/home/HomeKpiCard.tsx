import Link from "next/link";
import { NumberTicker, type TickerFormat } from "@/components/ui/NumberTicker";

type Props = {
  href: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  title?: string;
  /**
   * If provided, the value counts up from 0 on mount using the named formatter.
   * `value` is still used for SSR / no-JS / reduced-motion fallback.
   */
  numericValue?: number | null;
  format?: TickerFormat;
};

export function HomeKpiCard({ href, label, value, sub, title, numericValue, format }: Props) {
  return (
    <Link
      href={href}
      title={title}
      className="block text-left bg-surface rounded-card border border-rule hover:border-emerald/40 hover:-translate-y-px hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5),0_0_18px_-8px_rgba(34,211,168,0.2)] p-4 transition-all duration-200 min-h-[100px]"
    >
      <div className="eyebrow mb-2">{label}</div>
      <div className="text-[26px] font-semibold leading-none tabnum text-ink-strong">
        {numericValue != null && format ? (
          <NumberTicker value={numericValue} format={format} />
        ) : (
          value
        )}
      </div>
      {sub && <div className="mt-2 text-[11px] text-ink-muted leading-snug">{sub}</div>}
    </Link>
  );
}
