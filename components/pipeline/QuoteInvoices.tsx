"use client";

// Invoices linked to a single quote/project. Rendered at the bottom of
// /pipeline/[id]. Mirrors the invoices table on the client detail page and
// reuses the shared InvoiceSheet drawer for detail/editing.

import { useState } from "react";
import type { MoneyInvoice } from "@/lib/money";
import { Section } from "@/components/ui/Section";
import { InvoiceSheet } from "@/components/money/InvoiceSheet";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—";

const VOID_STATUSES = new Set(["void", "Canceled", "Refunded"]);

type Props = {
  quoteId: string;
  invoices: MoneyInvoice[];
  canEdit: boolean;
};

export function QuoteInvoices({ quoteId, invoices, canEdit }: Props) {
  const [selected, setSelected] = useState<MoneyInvoice | null>(null);

  const total = invoices
    .filter((i) => !VOID_STATUSES.has(i.status ?? ""))
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const outstanding = invoices
    .filter((i) => i.status !== "paid" && !VOID_STATUSES.has(i.status ?? ""))
    .reduce((s, i) => s + (i.amount ?? 0), 0);

  return (
    <>
      <Section
        title="Invoices"
        tone="amber"
        collapsible
        defaultOpen={false}
        storageKey={`qs:${quoteId}:invoices`}
        bodyPadding={false}
        meta={`${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"} · ${fmtCurrency(total)} invoiced · ${fmtCurrency(outstanding)} outstanding`}
      >
        {invoices.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-ink-muted">
            No invoices linked to this project.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-elevated border-b border-rule">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">#</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Date</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Description</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Type</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Amount</th>
                </tr>
              </thead>
              <tbody className="row-zebra">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelected(inv)}
                    className="border-b border-rule-soft last:border-0 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-[12px] font-mono text-ink-muted">{inv.invoiceId ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-ink-muted">{fmtDate(inv.date)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink max-w-[300px] truncate" title={inv.description ?? ""}>
                      {inv.description ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-muted">{inv.type ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-muted">{inv.status ?? "—"}</td>
                    <td
                      className={`px-3 py-2.5 text-right text-[13px] tabnum font-semibold ${
                        inv.status === "paid"
                          ? "text-emerald"
                          : inv.status === "past due"
                            ? "text-red"
                            : "text-ink-strong"
                      }`}
                    >
                      {fmtCurrency(inv.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <InvoiceSheet
        invoice={selected}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onFilterByPayer={() => setSelected(null)}
      />
    </>
  );
}
