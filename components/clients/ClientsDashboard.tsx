"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientRow } from "@/lib/clients";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtMonthYear = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const PARTNER_OPTIONS = ["all", "Lead", "Client"] as const;
const LEAD_STATUS_OPTIONS = [
  "all",
  "New Lead",
  "Discovery",
  "Proposal Drafting",
  "Proposal Sent",
  "Won",
  "Lost",
  "On Hold",
] as const;
type PartnerFilter = (typeof PARTNER_OPTIONS)[number];
type LeadStatusFilter = (typeof LEAD_STATUS_OPTIONS)[number];

const PARTNER_COLOR: Record<string, string> = {
  Client: "bg-emerald-soft text-emerald",
  Lead: "bg-violet-soft text-violet",
};

type SortKey =
  | "name"
  | "lifetimeRevenue"
  | "outstandingAR"
  | "invoiceCount"
  | "daysSinceLastInvoice"
  | "partnerStatus"
  | "communicationStartDate";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const COL_COUNT = 7;

export function ClientsDashboard({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [partner, setPartner] = useState<PartnerFilter>("all");
  const [leadStatus, setLeadStatus] = useState<LeadStatusFilter>("all");
  const [sort, setSort] = useState<Sort>({ key: "communicationStartDate", dir: "desc" });

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q)) return false;
      }
      if (partner !== "all" && c.partnerStatus !== partner) return false;
      if (leadStatus !== "all" && c.leadStatus !== leadStatus) return false;
      return true;
    });
  }, [clients, search, partner, leadStatus]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sort.key) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "lifetimeRevenue":
          av = a.lifetimeRevenue;
          bv = b.lifetimeRevenue;
          break;
        case "outstandingAR":
          av = a.outstandingAR;
          bv = b.outstandingAR;
          break;
        case "invoiceCount":
          av = a.invoiceCount;
          bv = b.invoiceCount;
          break;
        case "daysSinceLastInvoice":
          av = a.daysSinceLastInvoice ?? Number.MAX_SAFE_INTEGER;
          bv = b.daysSinceLastInvoice ?? Number.MAX_SAFE_INTEGER;
          break;
        case "partnerStatus":
          av = a.partnerStatus ?? "";
          bv = b.partnerStatus ?? "";
          break;
        case "communicationStartDate": {
          // nulls sort last regardless of direction
          const aNull = !a.communicationStartDate;
          const bNull = !b.communicationStartDate;
          if (aNull && bNull) return 0;
          if (aNull) return 1;
          if (bNull) return -1;
          av = a.communicationStartDate as string;
          bv = b.communicationStartDate as string;
          break;
        }
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

  const groups = useMemo(() => {
    const leads: ClientRow[] = [];
    const clientsG: ClientRow[] = [];
    const other: ClientRow[] = [];
    for (const c of sorted) {
      if (c.partnerStatus === "Lead") leads.push(c);
      else if (c.partnerStatus === "Client") clientsG.push(c);
      else other.push(c);
    }
    return [
      { key: "Lead", label: "Leads", rows: leads },
      { key: "Client", label: "Clients", rows: clientsG },
      { key: "Other", label: "Unclassified", rows: other },
    ] as const;
  }, [sorted]);

  const toggleSort = (key: SortKey) => {
    if (sort.key === key) setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    else setSort({ key, dir: "desc" });
  };

  const sortArrow = (key: SortKey) =>
    sort.key === key ? <span className="text-emerald text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span> : null;

  return (
    <>
      {/* Filter row */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none pl-8 w-full"
          />
        </div>
        <select
          value={partner}
          onChange={(e) => setPartner(e.target.value as PartnerFilter)}
          className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none cursor-pointer"
          aria-label="Partner status filter"
        >
          {PARTNER_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === "all" ? "All types" : o}</option>
          ))}
        </select>
        <select
          value={leadStatus}
          onChange={(e) => setLeadStatus(e.target.value as LeadStatusFilter)}
          className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none cursor-pointer"
          aria-label="Lead status filter"
        >
          {LEAD_STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === "all" ? "All lead stages" : o}</option>
          ))}
        </select>
        <div className="text-[11px] font-mono text-ink-faint tabnum">
          Showing <span className="text-ink">{filtered.length.toLocaleString()}</span> of {clients.length.toLocaleString()} accounts
        </div>
      </div>

      {/* Accounts table */}
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-elevated border-b border-rule">
              <tr>
                <th onClick={() => toggleSort("name")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-left">
                  Account {sortArrow("name")}
                </th>
                <th onClick={() => toggleSort("partnerStatus")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-left">
                  Type {sortArrow("partnerStatus")}
                </th>
                <th onClick={() => toggleSort("communicationStartDate")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-left">
                  Started {sortArrow("communicationStartDate")}
                </th>
                <th onClick={() => toggleSort("invoiceCount")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Invoices {sortArrow("invoiceCount")}
                </th>
                <th onClick={() => toggleSort("lifetimeRevenue")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Lifetime $ {sortArrow("lifetimeRevenue")}
                </th>
                <th onClick={() => toggleSort("outstandingAR")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Outstanding {sortArrow("outstandingAR")}
                </th>
                <th onClick={() => toggleSort("daysSinceLastInvoice")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Last seen {sortArrow("daysSinceLastInvoice")}
                </th>
              </tr>
            </thead>
            {sorted.length === 0 ? (
              <tbody>
                <tr><td colSpan={COL_COUNT} className="px-3 py-8 text-center text-[13px] text-ink-muted">No accounts match the current filters.</td></tr>
              </tbody>
            ) : (
              groups.filter((g) => g.rows.length > 0).map((g) => (
                <tbody key={g.key}>
                  <tr className="bg-bg-elevated border-y border-rule">
                    <td colSpan={COL_COUNT} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      {g.label} <span className="text-ink-faint tabnum font-mono">· {g.rows.length}</span>
                    </td>
                  </tr>
                  {g.rows.map((c) => {
                    const atRisk = c.engagement === "Active" && c.daysSinceLastInvoice != null && c.daysSinceLastInvoice > 90;
                    return (
                      <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="border-b border-rule-soft last:border-0 cursor-pointer transition-colors hover:bg-bg-elevated">
                        <td className="px-3 py-2.5 text-[13px] text-ink-strong">{c.name}</td>
                        <td className="px-3 py-2.5">
                          {c.partnerStatus ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${PARTNER_COLOR[c.partnerStatus] ?? "bg-rule text-ink-muted"}`}>
                              {c.partnerStatus}
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">{fmtMonthYear(c.communicationStartDate)}</td>
                        <td className="px-3 py-2.5 text-right text-[12px] font-mono tabnum text-ink-muted">{c.invoiceCount}</td>
                        <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-strong tabnum">{fmtCurrency(c.lifetimeRevenue)}</td>
                        <td className={`px-3 py-2.5 text-right text-[12px] tabnum font-mono ${c.outstandingAR > 0 ? "text-red font-semibold" : "text-ink-faint"}`}>
                          {c.outstandingAR > 0 ? fmtCurrency(c.outstandingAR) : "—"}
                        </td>
                        <td className={`px-3 py-2.5 text-right text-[12px] font-mono tabnum ${atRisk ? "text-red font-semibold" : "text-ink-muted"}`}>
                          {c.daysSinceLastInvoice != null ? `${c.daysSinceLastInvoice}d` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))
            )}
          </table>
        </div>
      </div>
    </>
  );
}
