"use client";

// Hero bento for the home page. One oversized YTD revenue tile flanked by a
// stack of three pipeline/recurring KPIs, then a three-up row of operational
// numbers. Every tile deep-links into the underlying page.
import Link from "next/link";
import type { ReactNode } from "react";
import type { FirmPulse } from "@/lib/firm-pulse";
import { NumberTicker } from "@/components/ui/NumberTicker";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

type Tone = "emerald" | "amber" | "red" | "sky" | "violet" | "neutral";

const TONE_DOT: Record<Tone, string> = {
  emerald: "bg-emerald",
  amber: "bg-amber",
  red: "bg-red",
  sky: "bg-sky",
  violet: "bg-violet",
  neutral: "bg-ink-faint",
};

function TileShell({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative block bg-surface border border-rule rounded-card p-5 overflow-hidden transition-all duration-200 hover:border-emerald/40 hover:-translate-y-px hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6),0_0_24px_-10px_rgba(34,211,168,0.25)] ${className}`}
    >
      {children}
    </Link>
  );
}

function Eyebrow({ children, dot }: { children: ReactNode; dot?: Tone }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-ink-faint">
      {dot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${TONE_DOT[dot]}`} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

function Satellite({
  href,
  label,
  value,
  numeric,
  format,
  sub,
  tone = "neutral",
  delay = 0,
}: {
  href: string;
  label: string;
  value: string;
  numeric?: number;
  format?: "currency" | "percent" | "number";
  sub: ReactNode;
  tone?: Tone;
  delay?: number;
}) {
  return (
    <TileShell href={href}>
      <Eyebrow dot={tone}>{label}</Eyebrow>
      <div className="mt-2 text-[28px] font-semibold leading-none tabnum text-ink-strong">
        {numeric != null && format ? (
          <NumberTicker value={numeric} format={format} delay={delay} />
        ) : (
          value
        )}
      </div>
      <div className="mt-2 text-[11px] text-ink-muted leading-snug">{sub}</div>
    </TileShell>
  );
}

export function FirmPulse({ pulse }: { pulse: FirmPulse }) {
  const r = pulse.revenue;
  const verdictTone: Tone = r.verdict === "ahead" ? "emerald" : r.verdict === "on-pace" ? "amber" : "red";
  const verdictGlyph = r.verdict === "ahead" ? "✓" : r.verdict === "on-pace" ? "◐" : "✗";
  const verdictColor =
    r.verdict === "ahead" ? "text-emerald" : r.verdict === "on-pace" ? "text-amber" : "text-red";

  const trackPct = Math.min(100, Math.max(0, r.pct * 100));
  const yearPct = Math.floor(((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (365 * 86_400_000)) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* ── Hero: YTD revenue ──────────────────────────── */}
      <Link
        href="/money"
        className="group relative lg:col-span-7 bg-surface border border-rule rounded-card p-6 sm:p-7 overflow-hidden transition-all duration-200 hover:border-emerald/50 hover:-translate-y-px hover:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7),0_0_36px_-12px_rgba(34,211,168,0.35)]"
      >
        {/* Ambient emerald wash, top-right */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-60 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(34,211,168,0.18), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <Eyebrow dot="emerald">YTD Revenue · Collected</Eyebrow>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint tabnum">
              {Math.round(r.pct * 100)}% of {fmtCompact(r.target)}
            </div>
          </div>

          <div className="text-[44px] sm:text-[56px] font-semibold leading-[0.95] tabnum text-ink-strong">
            <NumberTicker value={r.value} format="currency" />
          </div>

          {/* Progress track */}
          <div className="relative mt-5 h-2 rounded-full bg-rule overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${trackPct}%`,
                background: "linear-gradient(90deg, #22D3A8 0%, #5CE6C5 100%)",
                boxShadow: "0 0 16px -2px rgba(34,211,168,0.55)",
              }}
            />
            {/* Year-pace marker */}
            <div
              className="absolute top-[-4px] bottom-[-4px] w-px bg-ink-muted/70"
              style={{ left: `${Math.min(100, yearPct)}%` }}
              title={`Year is ${yearPct}% complete`}
            />
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-4 flex-wrap">
            <div className={`text-[13px] font-medium ${verdictColor} tabnum`}>
              <span className="mr-1.5">{verdictGlyph}</span>
              {r.verdictLabel}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint tabnum">
              Year {yearPct}% elapsed
            </div>
          </div>
        </div>
      </Link>

      {/* ── Satellite stack (right column) ─────────────── */}
      <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
        <Satellite
          href="/pipeline?stage=won"
          label="Booked YTD"
          value={fmt(pulse.booked.value)}
          numeric={pulse.booked.value}
          format="currency"
          delay={120}
          tone="emerald"
          sub={
            <>
              <span className="text-ink-strong tabnum">{pulse.booked.count}</span> signed{" "}
              {pulse.booked.count === 1 ? "deal" : "deals"} this year
            </>
          }
        />
        <Satellite
          href="/pipeline"
          label="Open Pipeline"
          value={fmt(pulse.pipeline.value)}
          numeric={pulse.pipeline.value}
          format="currency"
          delay={200}
          tone={pulse.pipeline.stalledValue > 0 ? "amber" : "sky"}
          sub={
            <>
              <span className="text-ink-strong tabnum">{pulse.pipeline.count}</span> quote
              {pulse.pipeline.count === 1 ? "" : "s"}
              {pulse.pipeline.stalledValue > 0 && (
                <>
                  {" · "}
                  <span className="text-amber tabnum">
                    {fmt(pulse.pipeline.stalledValue)} stalled &gt;14d
                  </span>
                </>
              )}
            </>
          }
        />
        <Satellite
          href="/money?scope=recurring"
          label="MRR"
          value={fmt(pulse.mrr.value)}
          numeric={pulse.mrr.value}
          format="currency"
          delay={280}
          tone="emerald"
          sub={
            <>
              <span className="text-ink-strong tabnum">{pulse.mrr.subs}</span> active sub
              {pulse.mrr.subs === 1 ? "" : "s"} ·{" "}
              <span className="tabnum">{Math.round(pulse.mrr.pct * 100)}%</span> of target
            </>
          }
        />
      </div>

      {/* ── Bottom row: operational ────────────────────── */}
      <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Satellite
          href="/pipeline?stage=active"
          label="Active Work"
          value={fmt(pulse.active.value)}
          numeric={pulse.active.value}
          format="currency"
          delay={360}
          tone="sky"
          sub={
            <>
              <span className="text-ink-strong tabnum">{pulse.active.count}</span>{" "}
              {pulse.active.count === 1 ? "project" : "projects"} in flight ·{" "}
              <span className="tabnum">{fmt(pulse.active.unpaid)}</span> unpaid
            </>
          }
        />
        <Satellite
          href="/money?status=outstanding"
          label="Open AR"
          value={fmt(pulse.ar.value)}
          numeric={pulse.ar.value}
          format="currency"
          delay={440}
          tone={pulse.ar.overdue > 0 ? "red" : "amber"}
          sub={
            <>
              <span className="text-ink-strong tabnum">{pulse.ar.count}</span> invoice
              {pulse.ar.count === 1 ? "" : "s"}
              {pulse.ar.overdue > 0 && (
                <>
                  {" · "}
                  <span className="text-red tabnum">{pulse.ar.overdue} overdue</span>
                </>
              )}
            </>
          }
        />
        <Satellite
          href="/pipeline"
          label="Quote → Paid"
          value={`${Math.round(pulse.conversion.pct * 100)}%`}
          numeric={pulse.conversion.pct * 100}
          format="percent"
          delay={520}
          tone={pulse.conversion.pct >= 0.5 ? "emerald" : pulse.conversion.pct >= 0.3 ? "amber" : "red"}
          sub={
            <>
              <span className="text-ink-strong tabnum">{pulse.conversion.paid}</span> paid /{" "}
              <span className="tabnum">{pulse.conversion.sent}</span> sent lifetime
            </>
          }
        />
      </div>
    </div>
  );
}
