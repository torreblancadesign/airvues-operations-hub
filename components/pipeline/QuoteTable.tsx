"use client";

import { PipelineQuote } from "@/lib/pipeline";
import { deadlineRiskClass, deadlineRiskLabel } from "@/lib/deadline";
import { Sort, SortKey } from "./types";

type Props = {
  rows: PipelineQuote[];
  sort: Sort;
  setSort: (s: Sort) => void;
  onRowClick: (q: PipelineQuote) => void;
  selectedId: string | null;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const PROJECT_STAGES = [
  "Proposal Created",
  "Proposal Accepted",
  "Proposal Signed",
  "Commencement Invoice Paid",
  "First Draft Delivered",
  "Project Accepted",
  "Completion Invoice Paid",
];

function ProjectProgress({ status }: { status: string | null }) {
  const idx = status ? PROJECT_STAGES.indexOf(status) : -1;
  const filled = idx >= 0 ? idx + 1 : 0;
  const done = idx === PROJECT_STAGES.length - 1;
  const label = status
    ? `Client Journey — stage ${filled} of ${PROJECT_STAGES.length}: ${status}`
    : "Client Journey — no stage set";
  return (
    <div
      className="inline-flex items-center gap-[2px]"
      title={label}
      aria-label={label}
    >
      {PROJECT_STAGES.map((_, i) => (
        <span
          key={i}
          className={`block h-1.5 w-2 rounded-sm ${
            i < filled ? (done ? "bg-emerald" : "bg-sky") : "bg-rule"
          }`}
        />
      ))}
    </div>
  );
}

function statusPill(status: string | null): string {
  switch (status) {
    case "Paid":
      return "bg-emerald-soft text-emerald";
    case "Approved and Signed":
    case "Awaiting Payment":
    case "Project In Progress":
      return "bg-sky-soft text-sky";
    case "Sent. Awaiting Approval.":
      return "bg-amber-soft text-amber";
    case "Draft":
      return "bg-rule text-ink-muted";
    case "Cancelled":
    case "Rejected":
      return "bg-red-soft text-red line-through";
    case "Auditing 🚩":
      return "bg-violet-soft text-violet";
    default:
      return "bg-rule text-ink-muted";
  }
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

export function QuoteTable({ rows, sort, setSort, onRowClick, selectedId }: Props) {
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
              <SortHeader label="#" active={sort.key === "autonumber"} dir={sort.dir} onClick={() => toggle("autonumber")} />
              <SortHeader label="Prepared" active={sort.key === "preparedDate"} dir={sort.dir} onClick={() => toggle("preparedDate")} />
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Project</th>
              <SortHeader label="Client" active={sort.key === "client"} dir={sort.dir} onClick={() => toggle("client")} />
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Company</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Prep By</th>
              <th
                onClick={() => toggle("status")}
                className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer select-none text-left"
                title="Deal Stage — internal sales pipeline. Not shown to client. (Airtable field: Status)"
              >
                <span className="inline-flex items-center gap-1">
                  Deal Stage
                  <span className="text-ink-faint text-[10px]">ⓘ</span>
                  {sort.key === "status" && <span className="text-[8px] text-emerald">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </span>
              </th>
              <th
                className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left"
                title="Client Journey — 7-stage delivery progress shown on the web quote. (Airtable field: Project Status)"
              >
                <span className="inline-flex items-center gap-1">
                  Client Journey
                  <span className="text-ink-faint text-[10px]">ⓘ</span>
                </span>
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left" title="Client Delivery Due Date risk">Deadline</th>
              <SortHeader label="Days" align="right" active={sort.key === "daysSinceSent"} dir={sort.dir} onClick={() => toggle("daysSinceSent")} />
              <th
                onClick={() => toggle("totalCost")}
                className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer select-none text-right"
                title="Total contracted value of the quote (Airtable: Total Cost). Not the amount paid."
              >
                <span className="inline-flex items-center gap-1">
                  Quote Total
                  <span className="text-ink-faint text-[10px]">ⓘ</span>
                  {sort.key === "totalCost" && <span className="text-[8px] text-emerald">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </span>
              </th>
              <th
                onClick={() => toggle("uninvoiced")}
                className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer select-none text-right"
                title="Committed but not yet invoiced: Quote Total minus invoices linked to this quote. Excludes void invoices."
              >
                <span className="inline-flex items-center gap-1">
                  Uninvoiced
                  <span className="text-ink-faint text-[10px]">ⓘ</span>
                  {sort.key === "uninvoiced" && <span className="text-[8px] text-emerald">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-[13px] text-ink-muted">No quotes match the current filters.</td></tr>
            ) : (
              rows.map((q) => {
                const days = daysSince(q.preparedDate);
                const stale = days != null && days > 14 && (q.status === "Sent. Awaiting Approval." || q.status === "Draft" || q.status === "Auditing 🚩");
                return (
                  <tr key={q.id} onClick={() => onRowClick(q)} className={`border-b border-rule-soft last:border-0 cursor-pointer transition-colors ${selectedId === q.id ? "bg-emerald-soft" : "hover:bg-bg-elevated"}`}>
                    <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">{q.autonumber ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">{q.preparedDate ? new Date(q.preparedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</td>
                    <td className="px-3 py-2.5 text-[13px] text-ink-strong max-w-[280px] truncate">{q.projectName}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink">{q.client}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink max-w-[200px] truncate" title={q.company ?? undefined}>{q.company ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-muted">{q.preparedBy}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${statusPill(q.status)}`}>
                        {q.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ProjectProgress status={q.projectStatus} />
                    </td>
                    <td className="px-3 py-2.5">
                      {q.deliveryDueDate ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${deadlineRiskClass(q.deadlineRisk)}`}
                          title={`Client Delivery Due Date: ${new Date(q.deliveryDueDate).toLocaleDateString()}`}
                        >
                          {deadlineRiskLabel(q.deadlineRisk, q.deliveryDueDate)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-faint">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-[12px] font-mono tabnum ${stale ? "text-red font-semibold" : "text-ink-muted"}`}>
                      {days != null ? `${days}d` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-strong tabnum">{fmtCurrency(q.totalCost)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
