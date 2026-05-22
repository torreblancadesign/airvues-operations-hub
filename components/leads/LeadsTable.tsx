"use client";

import { Lead } from "@/lib/leads";
import { Sort, SortKey, STATUS_PILL } from "./types";

type Props = {
  rows: Lead[];
  sort: Sort;
  setSort: (s: Sort) => void;
  onRowClick: (l: Lead) => void;
  selectedId: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SortHeader({ label, active, dir, align = "left", onClick }: { label: string; active: boolean; dir: "asc" | "desc"; align?: "left" | "right"; onClick: () => void }) {
  return (
    <th onClick={onClick} className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer select-none ${align === "right" ? "text-right" : "text-left"}`}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-[8px] text-emerald">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

export function LeadsTable({ rows, sort, setSort, onRowClick, selectedId }: Props) {
  const toggle = (key: SortKey) => {
    if (sort.key === key) setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    else setSort({ key, dir: "desc" });
  };

  return (
    <div className="bg-surface border border-rule rounded-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-bg-elevated border-b border-rule">
            <tr>
              <SortHeader label="Created" active={sort.key === "createdTime"} dir={sort.dir} onClick={() => toggle("createdTime")} />
              <SortHeader label="Name" active={sort.key === "name"} dir={sort.dir} onClick={() => toggle("name")} />
              <SortHeader label="Company" active={sort.key === "company"} dir={sort.dir} onClick={() => toggle("company")} />
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Title</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Assessor</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Budget</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Source</th>
              <SortHeader label="Meeting" active={sort.key === "meetingDate"} dir={sort.dir} onClick={() => toggle("meetingDate")} />
              <SortHeader label="Status" active={sort.key === "status"} dir={sort.dir} onClick={() => toggle("status")} />
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-right">Quotes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-[13px] text-ink-muted">No leads match the current filters.</td></tr>
            ) : (
              rows.map((l) => (
                <tr key={l.id} onClick={() => onRowClick(l)} className={`border-b border-rule-soft last:border-0 cursor-pointer transition-colors ${selectedId === l.id ? "bg-emerald-soft" : "hover:bg-bg-elevated"}`}>
                  <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">{fmtDate(l.createdTime)}</td>
                  <td className="px-3 py-2.5 text-[13px] text-ink-strong">{l.name}</td>
                  <td className="px-3 py-2.5 text-[12px] text-ink">{l.company ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted max-w-[200px] truncate">{l.title ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted">{l.assessorName ?? <span className="text-ink-faint">—</span>}</td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted font-mono">{l.budget ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[11px] text-ink-muted">{l.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">{fmtDateTime(l.meetingDate)}</td>
                  <td className="px-3 py-2.5">
                    {l.status ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${STATUS_PILL[l.status]}`}>
                        {l.status}
                      </span>
                    ) : <span className="text-ink-faint text-[11px]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-mono tabnum text-ink-muted">{l.quotesCount || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
