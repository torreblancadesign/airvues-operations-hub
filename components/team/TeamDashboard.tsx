"use client";

import { useMemo, useState } from "react";
import { TeamData, TeamMember, Payment } from "@/lib/team";
import { StatCard } from "@/components/ui/StatCard";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const PLACEHOLDER_EMAIL = "support@airvues.com";

type Tab = "people" | "payments";

export function TeamDashboard({ data }: { data: TeamData }) {
  const [tab, setTab] = useState<Tab>("people");
  const [search, setSearch] = useState("");
  const [showUnroutedOnly, setShowUnroutedOnly] = useState(false);
  const [showNeedsPaymentOnly, setShowNeedsPaymentOnly] = useState(false);

  const kpis = useMemo(() => {
    const active = data.members.filter((m) => m.status === "Active");
    const employees = active.filter((m) => m.internalType === "Employee").length;
    const contractors = active.filter((m) => m.internalType === "Contractor").length;
    const onboarding = data.members.filter((m) => m.status === "Onboarding" || (m.pandaDocStatus && ["Sent", "Viewed", "Draft"].includes(m.pandaDocStatus))).length;

    let owedTotal = 0;
    let owedCount = 0;
    let unroutedOwed = 0;
    let unroutedCount = 0;
    let paidLifetime = 0;
    for (const p of data.payments) {
      if (p.status === "Paid") paidLifetime += p.amount;
      if (p.status === "Needs Payment") {
        owedTotal += p.amount;
        owedCount += 1;
        if (p.payeeEmail === PLACEHOLDER_EMAIL) {
          unroutedOwed += p.amount;
          unroutedCount += 1;
        }
      }
    }

    let monthlyBurn = 0;
    for (const m of active) {
      if (m.compType === "Monthly" && m.compAmount) monthlyBurn += m.compAmount;
      if (m.payFrequency === "Bi-weekly" && m.compAmount) monthlyBurn += m.compAmount * 2.17;
    }

    return { active: active.length, employees, contractors, onboarding, owedTotal, owedCount, unroutedOwed, unroutedCount, paidLifetime, monthlyBurn };
  }, [data]);

  // Owed by person (payments aggregated, excluding placeholder)
  const owedByPerson = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    for (const p of data.payments) {
      if (p.status !== "Needs Payment") continue;
      if (p.payeeEmail === PLACEHOLDER_EMAIL) continue;
      const k = p.payeeEmail ?? "—";
      const existing = m.get(k) ?? { name: p.payeeName ?? "—", total: 0, count: 0 };
      existing.total += p.amount;
      existing.count += 1;
      m.set(k, existing);
    }
    return Array.from(m.entries()).map(([email, v]) => ({ email, ...v })).sort((a, b) => b.total - a.total);
  }, [data]);

  // Filtered table
  const activePeople = useMemo(
    () => data.members.filter((m) => m.status === "Active"),
    [data],
  );

  const filteredPeople = useMemo(() => {
    return activePeople.filter((m) => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [activePeople, search]);

  const filteredPayments = useMemo(() => {
    return data.payments.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.payeeName ?? ""} ${p.payeeEmail ?? ""} ${p.client ?? ""} ${p.project ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (showUnroutedOnly && p.payeeEmail !== PLACEHOLDER_EMAIL) return false;
      if (showNeedsPaymentOnly && p.status !== "Needs Payment") return false;
      return true;
    }).sort((a, b) => {
      // most-recent first
      if ((a.date ?? "") < (b.date ?? "")) return 1;
      if ((a.date ?? "") > (b.date ?? "")) return -1;
      return 0;
    });
  }, [data, search, showUnroutedOnly, showNeedsPaymentOnly]);

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <StatCard label="Active headcount" tone="emerald" value={kpis.active.toString()} sub={`${kpis.employees} employee · ${kpis.contractors} contractor`} />
        <StatCard label="Owed to team" tone="amber" value={fmtCurrency(kpis.owedTotal)} sub={`${kpis.owedCount} pending payments`} />
        <StatCard label="Unrouted ($)" tone="red" value={fmtCurrency(kpis.unroutedOwed)} sub={`${kpis.unroutedCount} on placeholder`} active={showUnroutedOnly && tab === "payments"} onClick={() => { setTab("payments"); setShowUnroutedOnly(true); setShowNeedsPaymentOnly(true); }} />
        <StatCard label="Onboarding queue" tone="sky" value={kpis.onboarding.toString()} sub="Active onboarding flow" />
        <StatCard label="Monthly comp burn" tone="neutral" value={fmtCurrency(kpis.monthlyBurn)} sub="Salaried · bi-weekly" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 mb-6">
        <StatCard label="Lifetime paid out" tone="emerald" value={fmtCurrency(kpis.paidLifetime)} sub="Across all team payments" />
        <StatCard label="Open invoices to team" tone="red" value={kpis.owedCount.toString()} sub={`${fmtCurrency(kpis.owedTotal)} outstanding`} active={showNeedsPaymentOnly && tab === "payments"} onClick={() => { setTab("payments"); setShowNeedsPaymentOnly(true); setShowUnroutedOnly(false); }} />
      </div>

      {/* Owed by person — top 10 */}
      {owedByPerson.length > 0 && (
        <div className="bg-surface rounded-card border border-rule p-5 mb-6">
          <div className="flex items-baseline justify-between mb-5">
            <h3 className="eyebrow">Owed by person — top {Math.min(10, owedByPerson.length)}</h3>
            <div className="text-[12px] text-ink-muted tabnum font-mono">
              <span className="text-ink-strong">{fmtCurrency(owedByPerson.reduce((s, x) => s + x.total, 0))}</span> outstanding (excluding placeholder)
            </div>
          </div>
          <div className="space-y-2">
            {owedByPerson.slice(0, 10).map((p) => {
              const max = owedByPerson[0].total;
              const widthPct = (p.total / max) * 100;
              return (
                <div key={p.email} className="grid grid-cols-[110px_1fr_80px_28px] sm:grid-cols-[180px_1fr_100px_40px] items-center gap-2 sm:gap-3">
                  <span className="text-[11px] sm:text-[12px] text-ink truncate">{p.name}</span>
                  <div className="h-4 sm:h-5 bg-bg rounded-sm overflow-hidden">
                    <div className="h-full bg-amber" style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="text-[11px] sm:text-[12px] text-ink-strong font-semibold tabnum text-right">{fmtCurrency(p.total)}</span>
                  <span className="text-[10px] sm:text-[11px] text-ink-faint tabnum font-mono text-right">{p.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-surface border border-rule rounded-md p-1">
          <button
            type="button"
            onClick={() => setTab("people")}
            className={`px-3 py-1.5 text-[12px] rounded ${tab === "people" ? "bg-emerald text-bg font-medium" : "text-ink-muted hover:text-ink-strong"}`}
          >
            People ({data.members.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("payments")}
            className={`px-3 py-1.5 text-[12px] rounded ${tab === "payments" ? "bg-emerald text-bg font-medium" : "text-ink-muted hover:text-ink-strong"}`}
          >
            Payments ({data.payments.length})
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === "people" ? "Search team..." : "Search payments..."}
          className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none min-w-[240px]"
        />
      </div>

      {tab === "people" ? (
        <PeopleTable rows={filteredPeople} />
      ) : (
        <PaymentsTable
          rows={filteredPayments}
          showUnroutedOnly={showUnroutedOnly}
          setShowUnroutedOnly={setShowUnroutedOnly}
          showNeedsPaymentOnly={showNeedsPaymentOnly}
          setShowNeedsPaymentOnly={setShowNeedsPaymentOnly}
        />
      )}
    </>
  );
}

function statusPill(status: string | null): string {
  if (!status) return "bg-rule text-ink-muted";
  switch (status) {
    case "Active":
      return "bg-emerald-soft text-emerald";
    case "Onboarding":
      return "bg-sky-soft text-sky";
    case "Former":
      return "bg-rule text-ink-faint";
    case "Innactive":
      return "bg-amber-soft text-amber";
    default:
      return "bg-rule text-ink-muted";
  }
}

function PeopleTable({ rows }: { rows: TeamMember[] }) {
  return (
    <div className="bg-surface border border-rule rounded-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-bg-elevated border-b border-rule">
            <tr>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Name</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Internal Type</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Status</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Comp</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-right">Comm %</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-right">Lifetime paid</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-right">Owed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[13px] text-ink-muted">No team members match.</td></tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-b border-rule-soft last:border-0 hover:bg-bg-elevated">
                  <td className="px-3 py-2.5 text-[13px] text-ink-strong">
                    <a href={`/me?as=${m.id}`} className="hover:text-emerald transition-colors font-medium">
                      {m.name}
                    </a>
                    {m.email && <div className="text-[11px] font-mono text-ink-faint">{m.email}</div>}
                    <a
                      href={m.airtableUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-ink-faint hover:text-emerald transition-colors"
                    >
                      Airtable ↗
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted">{m.internalType ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${statusPill(m.status)}`}>
                      {m.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted">{m.compType ? `${m.compType}${m.compAmount ? ` · ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(m.compAmount)}` : ""}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-mono tabnum text-ink-muted">{m.commissionPct != null ? `${(m.commissionPct * 100).toFixed(0)}%` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-[13px] text-ink-strong font-semibold tabnum">{m.totalPaid > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(m.totalPaid) : "—"}</td>
                  <td className={`px-3 py-2.5 text-right text-[12px] tabnum font-mono ${m.needsPayment > 0 ? "text-amber font-semibold" : "text-ink-faint"}`}>
                    {m.needsPayment > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(m.needsPayment) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsTable({
  rows,
  showUnroutedOnly,
  setShowUnroutedOnly,
  showNeedsPaymentOnly,
  setShowNeedsPaymentOnly,
}: {
  rows: Payment[];
  showUnroutedOnly: boolean;
  setShowUnroutedOnly: (v: boolean) => void;
  showNeedsPaymentOnly: boolean;
  setShowNeedsPaymentOnly: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted cursor-pointer">
          <input type="checkbox" checked={showNeedsPaymentOnly} onChange={(e) => setShowNeedsPaymentOnly(e.target.checked)} className="accent-emerald" />
          Needs payment only
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted cursor-pointer">
          <input type="checkbox" checked={showUnroutedOnly} onChange={(e) => setShowUnroutedOnly(e.target.checked)} className="accent-red" />
          Unrouted only (placeholder)
        </label>
      </div>
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-elevated border-b border-rule">
              <tr>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Date</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Payee</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Function</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Client / project</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Status</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px] text-ink-muted">No payments match.</td></tr>
              ) : (
                rows.slice(0, 500).map((p) => {
                  const unrouted = p.payeeEmail === PLACEHOLDER_EMAIL;
                  return (
                    <tr key={p.id} className="border-b border-rule-soft last:border-0 hover:bg-bg-elevated">
                      <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">
                        {p.date ? new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px]">
                        <a href={p.airtableUrl} target="_blank" rel="noopener noreferrer" className={`${unrouted ? "text-red" : "text-ink-strong"} hover:text-emerald transition-colors`}>
                          {p.payeeName ?? "—"}
                          {unrouted && <span className="ml-1.5 text-[10px] font-mono uppercase tracking-wider text-red">unrouted</span>}
                        </a>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-muted">{p.function ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-muted max-w-[280px] truncate">
                        {p.client ?? "—"}
                        {p.project && <span className="text-ink-faint"> · {p.project}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${p.status === "Paid" ? "bg-emerald-soft text-emerald" : "bg-amber-soft text-amber"}`}>
                          {p.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-strong tabnum">{fmtCurrency(p.amount)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 500 && (
          <div className="px-3 py-2 bg-bg-elevated border-t border-rule text-[11px] text-ink-muted font-mono">
            Showing first 500 of {rows.length} payments.
          </div>
        )}
      </div>
    </div>
  );
}
