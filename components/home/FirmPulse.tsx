"use client";

// Home firm pulse — single source of truth for firm-wide metrics.
// Organized into labeled bands so density is scannable:
//   Money · Sales funnel · Accounts · Projects · Schedule
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { FirmPulse, UpcomingMeeting } from "@/lib/firm-pulse";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { RevenueTrend } from "./RevenueTrend";

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
type Window = "ytd" | "mtd";

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

function BandLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2 mt-1">
      <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-ink-muted">{children}</span>
      <span className="flex-1 h-px bg-rule" />
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
      <div className="mt-2 text-[26px] font-semibold leading-none tabnum text-ink-strong">
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

function WindowToggle({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  const btn = (w: Window, label: string) => {
    const active = value === w;
    return (
      <button
        key={w}
        type="button"
        onClick={() => onChange(w)}
        className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-sm ${
          active ? "bg-emerald/15 text-emerald" : "text-ink-faint hover:text-ink-muted"
        }`}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="inline-flex items-center gap-0.5 bg-bg border border-rule rounded-md p-0.5">
      {btn("ytd", "YTD")}
      {btn("mtd", "MTD")}
    </div>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dk = new Date(d); dk.setHours(0, 0, 0, 0);
  if (dk.getTime() === today.getTime()) return "Today";
  if (dk.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function UpcomingMeetingsCard({ meetings }: { meetings: UpcomingMeeting[] }) {
  if (meetings.length === 0) {
    return (
      <div className="bg-surface border border-rule rounded-card p-5">
        <Eyebrow dot="sky">Upcoming intro meetings · next 14d</Eyebrow>
        <div className="mt-4 text-[13px] text-ink-muted text-center py-4">No upcoming intros scheduled.</div>
      </div>
    );
  }
  // group by day
  const groups = new Map<string, UpcomingMeeting[]>();
  for (const m of meetings) {
    const key = m.meetingDate.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return (
    <div className="bg-surface border border-rule rounded-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <Eyebrow dot="sky">Upcoming intro meetings · next 14d</Eyebrow>
        <Link href="/leads" className="text-[10px] font-mono uppercase tracking-wider text-emerald hover:underline">
          Open Leads →
        </Link>
      </div>
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([key, items]) => (
          <div key={key}>
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted mb-2 pb-1 border-b border-rule-soft">
              {dayLabel(key)} · {items.length}
            </div>
            <ul className="space-y-1.5">
              {items.map((m) => (
                <li key={m.id}>
                  <Link
                    href="/leads"
                    className="flex items-baseline gap-3 p-2 -mx-2 rounded hover:bg-bg-elevated transition-colors"
                  >
                    <span className="text-[12px] font-mono tabnum text-ink-strong shrink-0 w-16">{fmtTime(m.meetingDate)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="text-[13px] text-ink-strong font-medium">{m.name}</span>
                      {m.company && <span className="text-[12px] text-ink-muted"> · {m.company}</span>}
                      {m.whatToBuild && (
                        <span className="block text-[11px] text-ink-faint truncate">{m.whatToBuild}</span>
                      )}
                    </span>
                    {m.budget && (
                      <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-soft text-violet">{m.budget}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FirmPulse({ pulse }: { pulse: FirmPulse }) {
  const [win, setWin] = useState<Window>("ytd");
  const r = pulse.revenue[win];
  const booked = pulse.booked[win];
  const conv = pulse.conversion[win];
  const leadsW = pulse.leads[win];
  const lostW = win === "ytd" ? pulse.pipeline.lostYtd : pulse.pipeline.lostMtd;
  const windowLabel = win === "ytd" ? "YTD" : "MTD";

  const verdictGlyph = r.verdict === "ahead" ? "✓" : r.verdict === "on-pace" ? "◐" : "✗";
  const verdictColor =
    r.verdict === "ahead" ? "text-emerald" : r.verdict === "on-pace" ? "text-amber" : "text-red";

  const trackPct = Math.min(100, Math.max(0, r.pct * 100));

  const now = new Date();
  const elapsedPct =
    win === "ytd"
      ? Math.floor(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (365 * 86_400_000)) * 100)
      : Math.floor((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100);
  const elapsedLabel = win === "ytd" ? "Year" : "Month";

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <WindowToggle value={win} onChange={setWin} />
      </div>

      {/* ── BAND 1 · Money ────────────────────────────── */}
      <div>
        <BandLabel>Money</BandLabel>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Hero revenue tile */}
          <Link
            href="/money"
            className="group relative lg:col-span-7 bg-surface border border-rule rounded-card p-6 sm:p-7 overflow-hidden transition-all duration-200 hover:border-emerald/50 hover:-translate-y-px hover:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7),0_0_36px_-12px_rgba(34,211,168,0.35)]"
          >
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-60 blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(34,211,168,0.18), transparent 70%)" }}
              aria-hidden
            />
            <div className="relative">
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <Eyebrow dot="emerald">{windowLabel} Revenue · Collected</Eyebrow>
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint tabnum">
                  {Math.round(r.pct * 100)}% of {fmtCompact(r.target)}
                </div>
              </div>
              <div className="text-[44px] sm:text-[56px] font-semibold leading-[0.95] tabnum text-ink-strong">
                <NumberTicker value={r.value} format="currency" />
              </div>
              <div className="relative mt-5 h-2 rounded-full bg-rule overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${trackPct}%`,
                    background: "linear-gradient(90deg, #22D3A8 0%, #5CE6C5 100%)",
                    boxShadow: "0 0 16px -2px rgba(34,211,168,0.55)",
                  }}
                />
                <div
                  className="absolute top-[-4px] bottom-[-4px] w-px bg-ink-muted/70"
                  style={{ left: `${Math.min(100, elapsedPct)}%` }}
                  title={`${elapsedLabel} is ${elapsedPct}% complete`}
                />
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-4 flex-wrap">
                <div className={`text-[13px] font-medium ${verdictColor} tabnum`}>
                  <span className="mr-1.5">{verdictGlyph}</span>
                  {r.verdictLabel}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint tabnum">
                  {elapsedLabel} {elapsedPct}% elapsed
                </div>
              </div>
              <div className="hidden lg:block mt-6">
                <RevenueTrend series={r.series} target={r.target} windowName={win} />
              </div>
            </div>
          </Link>

          {/* Right stack: MRR, AR, Active work */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
            <Satellite
              href="/money?scope=recurring"
              label="MRR"
              value={fmt(pulse.mrr.value)}
              numeric={pulse.mrr.value}
              format="currency"
              delay={120}
              tone="emerald"
              sub={
                <>
                  <span className="text-ink-strong tabnum">{pulse.mrr.subs}</span> active sub
                  {pulse.mrr.subs === 1 ? "" : "s"} ·{" "}
                  <span className="tabnum">{Math.round(pulse.mrr.pct * 100)}%</span> of target
                </>
              }
            />
            <Satellite
              href="/money?status=outstanding"
              label="Open AR"
              value={fmt(pulse.ar.value)}
              numeric={pulse.ar.value}
              format="currency"
              delay={200}
              tone={pulse.ar.overdue > 0 ? "red" : "amber"}
              sub={
                <>
                  <span className="text-ink-strong tabnum">{pulse.ar.count}</span> invoice
                  {pulse.ar.count === 1 ? "" : "s"}
                  {pulse.ar.overdue > 0 && (
                    <> · <span className="text-red tabnum">{pulse.ar.overdue} overdue</span></>
                  )}
                </>
              }
            />
            <Satellite
              href="/pipeline?stage=active"
              label="Active Work"
              value={fmt(pulse.active.value)}
              numeric={pulse.active.value}
              format="currency"
              delay={280}
              tone="sky"
              sub={
                <>
                  <span className="text-ink-strong tabnum">{pulse.active.count}</span>{" "}
                  {pulse.active.count === 1 ? "project" : "projects"} ·{" "}
                  <span className="tabnum">{fmt(pulse.active.unpaid)}</span> unpaid
                </>
              }
            />
            <Satellite
              href="/pipeline?stage=active"
              label="Committed · uninvoiced"
              value={fmt(pulse.uninvoiced.value)}
              numeric={pulse.uninvoiced.value}
              format="currency"
              delay={340}
              tone="violet"
              sub={
                <>
                  <span className="text-ink-strong tabnum">{pulse.uninvoiced.count}</span>{" "}
                  active {pulse.uninvoiced.count === 1 ? "project" : "projects"} · invoice when shipped
                </>
              }
            />
          </div>
        </div>
      </div>

      {/* ── BAND 2 · Sales funnel ─────────────────────── */}
      <div>
        <BandLabel>Sales funnel</BandLabel>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Satellite
            href="/leads"
            label={`Leads ${windowLabel}`}
            value={leadsW.count.toLocaleString()}
            numeric={leadsW.count}
            format="number"
            delay={120}
            tone="sky"
            sub={
              <>
                <span className="text-ink-strong tabnum">
                  {leadsW.avgDaysBetween != null ? `${leadsW.avgDaysBetween.toFixed(1)}d` : "—"}
                </span>{" "}
                avg between · <span className="tabnum">{leadsW.avgTimeToMeeting != null ? `${leadsW.avgTimeToMeeting.toFixed(1)}d` : "—"}</span> to meet
              </>
            }
          />
          <Satellite
            href="/leads?status=In+Proposal+Stage"
            label="In Proposal"
            value={pulse.leads.inProposal.toLocaleString()}
            numeric={pulse.leads.inProposal}
            format="number"
            delay={180}
            tone="amber"
            sub={<>Lifetime · open proposals in flight</>}
          />
          <Satellite
            href="/pipeline?stage=signed"
            label={`Booked ${windowLabel}`}
            value={fmt(booked.value)}
            numeric={booked.value}
            format="currency"
            delay={240}
            tone="emerald"
            sub={
              <>
                <span className="text-ink-strong tabnum">{booked.count}</span> signed{" "}
                {booked.count === 1 ? "deal" : "deals"}
              </>
            }
          />
          <Satellite
            href="/pipeline"
            label="Open Pipeline"
            value={fmt(pulse.pipeline.value)}
            numeric={pulse.pipeline.value}
            format="currency"
            delay={300}
            tone={pulse.pipeline.stalledValue > 0 ? "amber" : "sky"}
            sub={
              <>
                <span className="text-ink-strong tabnum">{pulse.pipeline.count}</span> quote
                {pulse.pipeline.count === 1 ? "" : "s"}
                {pulse.pipeline.stalledValue > 0 && (
                  <> · <span className="text-amber tabnum">{fmt(pulse.pipeline.stalledValue)} stalled</span></>
                )}
              </>
            }
          />
          <Satellite
            href="/pipeline"
            label={`Quote → Sold ${windowLabel}`}
            value={`${Math.round(conv.soldPct * 100)}%`}
            numeric={conv.soldPct * 100}
            format="percent"
            delay={360}
            tone={conv.soldPct >= 0.5 ? "emerald" : conv.soldPct >= 0.3 ? "amber" : "red"}
            sub={
              <>
                <span className="text-ink-strong tabnum">{conv.sold}</span> /{" "}
                <span className="tabnum">{conv.sent}</span> sent · {Math.round(conv.paidPct * 100)}% fully paid
              </>
            }
          />
          <Satellite
            href="/pipeline?stage=lost"
            label={`Lost ${windowLabel}`}
            value={lostW.toLocaleString()}
            numeric={lostW}
            format="number"
            delay={420}
            tone={lostW > 0 ? "red" : "neutral"}
            sub={<>Cancelled or rejected quotes</>}
          />
        </div>
      </div>

      {/* ── BAND 3 · Accounts ─────────────────────────── */}
      <div>
        <BandLabel>Accounts</BandLabel>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Satellite
            href="/clients"
            label="Total accounts"
            value={pulse.clients.total.toLocaleString()}
            numeric={pulse.clients.total}
            format="number"
            delay={120}
            tone="neutral"
            sub={<>All companies on record</>}
          />
          <Satellite
            href="/clients"
            label="Active clients"
            value={pulse.clients.active.toLocaleString()}
            numeric={pulse.clients.active}
            format="number"
            delay={180}
            tone="emerald"
            sub={<>Currently engaged</>}
          />
          <Satellite
            href="/clients"
            label="At-risk active"
            value={pulse.clients.atRisk.toLocaleString()}
            numeric={pulse.clients.atRisk}
            format="number"
            delay={240}
            tone={pulse.clients.atRisk > 0 ? "amber" : "neutral"}
            sub={<>Active · no invoice 90d+</>}
          />
          <Satellite
            href="/money?status=outstanding"
            label="Account AR"
            value={fmt(pulse.clients.outstandingAR)}
            numeric={pulse.clients.outstandingAR}
            format="currency"
            delay={300}
            tone={pulse.clients.outstandingAR > 0 ? "red" : "neutral"}
            sub={<>Owed across all accounts</>}
          />
          <Satellite
            href="/clients"
            label="Whale exposure"
            value={`${Math.round(pulse.clients.top10Pct * 100)}%`}
            numeric={pulse.clients.top10Pct * 100}
            format="percent"
            delay={360}
            tone="violet"
            sub={<>Top 10 = {fmtCompact(pulse.clients.top10Total)}</>}
          />
        </div>
      </div>

      {/* ── BAND 4 · Projects ─────────────────────────── */}
      <div>
        <BandLabel>Projects</BandLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Satellite
            href="/pipeline?stage=active"
            label="Active projects"
            value={pulse.projects[win].active.toLocaleString()}
            numeric={pulse.projects[win].active}
            format="number"
            delay={120}
            tone={pulse.projects[win].active > 0 ? "sky" : "neutral"}
            sub={<>In flight right now</>}
          />
          <Satellite
            href="/pipeline?stage=paid"
            label={`Completed ${windowLabel}`}
            value={pulse.projects[win].completed.toLocaleString()}
            numeric={pulse.projects[win].completed}
            format="number"
            delay={180}
            tone="emerald"
            sub={<>Completion invoice paid</>}
          />
          <Satellite
            href="/clients"
            label={`New clients ${windowLabel}`}
            value={pulse.newClients[win].count.toLocaleString()}
            numeric={pulse.newClients[win].count}
            format="number"
            delay={240}
            tone="emerald"
            sub={<>First paid invoice landed</>}
          />
          <Satellite
            href="/money"
            label={`Revenue by source · ${windowLabel}`}
            value={pulse.revenueBySource[win][0] ? fmt(pulse.revenueBySource[win][0].revenue) : "—"}
            sub={
              pulse.revenueBySource[win].length === 0 ? (
                <>No paid invoices yet</>
              ) : (
                <>
                  {pulse.revenueBySource[win].slice(0, 3).map((s, i) => (
                    <span key={s.source}>
                      {i > 0 && " · "}
                      <span className="text-ink-strong">{s.source}</span>{" "}
                      <span className="tabnum">{fmtCompact(s.revenue)}</span>
                    </span>
                  ))}
                </>
              )
            }
          />
        </div>
      </div>

      {/* ── BAND 5 · Schedule ─────────────────────────── */}
      <div>
        <BandLabel>Schedule</BandLabel>
        <UpcomingMeetingsCard meetings={pulse.upcomingMeetings} />
      </div>
    </div>
  );
}
