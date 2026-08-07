"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RetainerBoardRow } from "@/lib/retainer-types";

const chip =
  "inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider";

function fmtHours(h: number | null): string {
  if (h === null) return "—";
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function periodLabel(row: RetainerBoardRow): string {
  if (!row.periodStart || !row.periodEnd) return "no effective date";
  return `${row.periodStart.slice(5, 10)} → ${row.periodEnd.slice(5, 10)}`;
}

export function RetainerBoard({ rows }: { rows: RetainerBoardRow[] }) {
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (attentionOnly && r.breachedNowCount === 0 && r.atRiskCount === 0) return false;
      if (!q) return true;
      return `${r.projectName} ${r.companyName ?? ""} ${r.tierName ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, attentionOnly]);

  if (rows.length === 0) {
    return (
      <section className="bg-surface border border-rule rounded-card px-4 py-10 text-center">
        <div className="text-[13px] text-ink-strong">No retainer agreements yet.</div>
        <div className="text-[12px] text-ink-muted mt-1">
          A quote appears here once its Proposal Type is “Retainer Agreement” and it has a
          Company link.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-rule rounded-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
        <div>
          <div className="eyebrow">Retainer health</div>
          <div className="text-[12px] text-ink-muted mt-0.5">
            {filtered.length} shown · {rows.length} total
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-ink-muted flex items-center gap-1.5 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
              className="accent-emerald"
            />
            Needs attention
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client or tier…"
            className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded-md focus:border-emerald focus:outline-none w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-ink-muted">
          Nothing matches.{" "}
          {attentionOnly && "No retainer is breached or at risk right now."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ink-faint border-b border-rule">
                <th className="text-left font-medium px-4 py-2">Retainer</th>
                <th className="text-left font-medium px-3 py-2">Tier</th>
                <th className="text-right font-medium px-3 py-2">Open</th>
                <th className="text-right font-medium px-3 py-2">Breached</th>
                <th className="text-right font-medium px-3 py-2">At risk</th>
                <th className="text-right font-medium px-3 py-2">Oldest wait</th>
                <th className="text-right font-medium px-3 py-2">
                  Hours
                  <div className="text-[9px] normal-case tracking-normal text-ink-faint">
                    logged, may lag
                  </div>
                </th>
                <th className="text-left font-medium px-3 py-2">Period</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.retainerId}
                  className="border-b border-rule/50 hover:bg-bg-elevated"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/retainers/${r.retainerId}`}
                      className="text-ink-strong hover:text-emerald font-medium"
                    >
                      {r.companyName ?? r.projectName}
                    </Link>
                    <div className="text-[11px] text-ink-muted truncate max-w-[280px]">
                      {r.projectName}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.tierName ? (
                      <>
                        <div className="text-ink">{r.tierName}</div>
                        {r.slaLabel && (
                          <div className="text-[10px] text-ink-faint">{r.slaLabel}</div>
                        )}
                      </>
                    ) : (
                      <span className={`${chip} bg-bg-elevated text-ink-muted`}>no tier</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink">{r.openCount}</td>
                  <td className="px-3 py-2.5 text-right tabnum">
                    {r.breachedNowCount > 0 ? (
                      <span className="text-red font-semibold">{r.breachedNowCount}</span>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum">
                    {r.atRiskCount > 0 ? (
                      <span className="text-amber font-semibold">{r.atRiskCount}</span>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink-muted">
                    {r.oldestUnansweredHours === null
                      ? "—"
                      : `${fmtHours(r.oldestUnansweredHours)}h`}
                  </td>
                  <td className="px-3 py-2.5 text-right tabnum text-ink-muted">
                    {fmtHours(r.hoursLoggedThisPeriod)}
                    {r.includedHours != null && (
                      <span className="text-ink-faint"> / {fmtHours(r.includedHours)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-ink-muted font-mono">
                    {periodLabel(r)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
