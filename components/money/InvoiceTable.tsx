"use client";

import { MoneyInvoice } from "@/lib/money";
import { Sort, SortKey } from "./types";

type Props = {
  rows: MoneyInvoice[];
  sort: Sort;
  setSort: (s: Sort) => void;
  onRowClick: (inv: MoneyInvoice) => void;
  selectedId: string | null;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function statusPill(status: string | null): string {
  switch (status) {
    case "paid":
      return "bg-emerald-soft text-emerald";
    case "past due":
      return "bg-red-soft text-red";
    case "open":
    case "sent":
    case "unsent":
      return "bg-amber-soft text-amber";
    case "subscribed":
    case "send subscription link":
      return "bg-sky-soft text-sky";
    case "void":
    case "Canceled":
    case "Refunded":
    case "failed":
      return "bg-rule text-ink-faint line-through";
    default:
      return "bg-rule text-ink-muted";
  }
}

function SortHeader({
  label,
  active,
  dir,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer select-none ${align === "right" ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-[8px] text-emerald">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

export function InvoiceTable({ rows, sort, setSort, onRowClick, selectedId }: Props) {
  const toggle = (key: SortKey) => {
    if (sort.key === key) {
      setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      setSort({ key, dir: "desc" });
    }
  };

  return (
    <div className="bg-surface border border-rule rounded-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-bg-elevated border-b border-rule">
            <tr>
              <SortHeader label="ID" active={sort.key === "invoiceId"} dir={sort.dir} onClick={() => toggle("invoiceId")} />
              <SortHeader label="Date" active={sort.key === "date"} dir={sort.dir} onClick={() => toggle("date")} />
              <SortHeader label="Payer" active={sort.key === "payer"} dir={sort.dir} onClick={() => toggle("payer")} />
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">
                Description
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">
                Source
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">
                Type
              </th>
              <SortHeader label="Status" active={sort.key === "status"} dir={sort.dir} onClick={() => toggle("status")} />
              <SortHeader label="Amount" align="right" active={sort.key === "amount"} dir={sort.dir} onClick={() => toggle("amount")} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[13px] text-ink-muted">
                  No invoices match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => onRowClick(inv)}
                  className={`border-b border-rule-soft last:border-0 cursor-pointer transition-colors ${
                    selectedId === inv.id ? "bg-emerald-soft" : "hover:bg-bg-elevated"
                  }`}
                >
                  <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">
                    {inv.invoiceId ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">
                    {inv.date ? new Date(inv.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-ink-strong">{inv.payer}</td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted max-w-[280px] truncate">
                    {inv.description ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted">{inv.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-muted">{inv.type ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${statusPill(inv.status)}`}>
                      {inv.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-strong tabnum">
                    {fmtCurrency(inv.amount)}
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
