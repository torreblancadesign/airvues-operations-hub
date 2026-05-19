"use client";

import { useEffect } from "react";
import { ClientRow } from "@/lib/clients";

type Props = {
  client: ClientRow | null;
  onClose: () => void;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-rule last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">{label}</div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

export function ClientSheet({ client, onClose }: Props) {
  useEffect(() => {
    if (!client) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [client, onClose]);

  if (!client) return null;
  const atRisk = client.engagement === "Active" && client.daysSinceLastInvoice != null && client.daysSinceLastInvoice > 90;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[460px] bg-surface z-50 border-l border-rule shadow-xl overflow-y-auto" role="dialog">
        <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">Client</div>
            <h2 className="text-[16px] font-semibold text-ink-strong leading-tight">{client.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[20px] text-ink-muted hover:text-ink-strong w-7 h-7 flex items-center justify-center rounded hover:bg-bg-elevated" aria-label="Close">×</button>
        </div>

        <div className="px-5 py-5 bg-bg-elevated border-b border-rule">
          <div className="text-[34px] font-semibold text-ink-strong tabnum leading-none">{fmtCurrency(client.lifetimeRevenue)}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-muted">
            <span className="font-mono">{client.engagement}</span>
            <span className="text-ink-faint">·</span>
            <span>{client.invoiceCount} invoice{client.invoiceCount === 1 ? "" : "s"}</span>
            {client.contractType && (
              <>
                <span className="text-ink-faint">·</span>
                <span>{client.contractType}</span>
              </>
            )}
          </div>
          {atRisk && (
            <div className="mt-3 inline-block px-2 py-1 bg-red-soft text-red rounded text-[11px] font-medium">
              At risk · no invoice in {client.daysSinceLastInvoice}d
            </div>
          )}
          {client.engagement === "New" && client.lifetimeRevenue > 1000 && (
            <div className="mt-3 inline-block px-2 py-1 bg-amber-soft text-amber rounded text-[11px] font-medium">
              Misclassified · marked "New" with revenue {fmtCurrency(client.lifetimeRevenue)}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-b border-rule flex gap-2 flex-wrap">
          <a href={client.airtableUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-medium rounded hover:bg-emerald/80 transition-colors">Open in Airtable ↗</a>
          {client.website && (
            <a href={client.website} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">Website ↗</a>
          )}
          {client.driveFolder && (
            <a href={client.driveFolder} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">Drive ↗</a>
          )}
        </div>

        <div className="px-5 py-2">
          <Field label="Engagement">{client.engagement}</Field>
          <Field label="Contract Type">{client.contractType ?? "—"}</Field>
          <Field label="Contacts on file">{client.contactCount} {client.contactCount === 1 ? "person" : "people"}</Field>
          <Field label="Lifetime revenue">{fmtCurrency(client.lifetimeRevenue)}</Field>
          <Field label="Outstanding AR">{fmtCurrency(client.outstandingAR)}</Field>
          <Field label="Total invoices">{client.invoiceCount}</Field>
          <Field label="Last invoice date">{fmtDate(client.lastInvoiceDate)}</Field>
          <Field label="Days since last invoice">{client.daysSinceLastInvoice != null ? `${client.daysSinceLastInvoice} days` : "—"}</Field>
          <Field label="NDA on file">{client.hasNDA ? "Yes" : "No"}</Field>
          <Field label="Website">{client.website ?? "—"}</Field>
          <Field label="Airtable Record ID"><span className="font-mono text-[12px]">{client.id}</span></Field>
        </div>
      </aside>
    </>
  );
}
