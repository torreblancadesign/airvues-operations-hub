"use client";

import { useMemo, useState } from "react";
import type { ClientDetail } from "@/lib/client-detail";
import type { PipelineQuote } from "@/lib/pipeline";
import type { MoneyInvoice } from "@/lib/money";
import type { PersonOption } from "@/lib/quote-types";
import { QuoteSheet } from "@/components/pipeline/QuoteSheet";
import { InvoiceSheet } from "@/components/money/InvoiceSheet";

type SprintOption = { id: string; number: number | null; status: string | null };

type Props = {
  detail: ClientDetail;
  people: PersonOption[];
  sprints: SprintOption[];
  canEdit: boolean;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const ENGAGEMENT_COLOR: Record<string, string> = {
  Active: "bg-emerald-soft text-emerald",
  Occasional: "bg-sky-soft text-sky",
  Iddle: "bg-amber-soft text-amber",
  Lost: "bg-red-soft text-red",
  New: "bg-violet-soft text-violet",
  Archived: "bg-rule text-ink-faint",
};

const COMPLETED_STATUSES = new Set(["Paid", "Cancelled", "Rejected"]);

function projectBucket(q: PipelineQuote): "active" | "completed" {
  if (q.status && COMPLETED_STATUSES.has(q.status)) return "completed";
  if (q.projectStatus === "Completion Invoice Paid") return "completed";
  return "active";
}

type Tab = "active" | "completed" | "all";

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-surface border border-rule rounded-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={`text-[20px] font-semibold tabnum mt-1 ${tone ?? "text-ink-strong"}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-faint mt-0.5">{sub}</div>}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="py-2 border-b border-rule last:border-0">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-0.5">{label}</div>
        {hint && <div className="text-[9px] text-ink-faint italic">{hint}</div>}
      </div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

export function ClientDetailView({ detail, people, sprints, canEdit }: Props) {
  const [tab, setTab] = useState<Tab>("active");
  const [selectedQuote, setSelectedQuote] = useState<PipelineQuote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<MoneyInvoice | null>(null);

  const projects = useMemo(() => {
    if (tab === "all") return detail.projects;
    return detail.projects.filter((p) => projectBucket(p) === tab);
  }, [detail.projects, tab]);

  const counts = useMemo(() => {
    let active = 0,
      completed = 0;
    for (const p of detail.projects) {
      if (projectBucket(p) === "active") active++;
      else completed++;
    }
    return { active, completed, all: detail.projects.length };
  }, [detail.projects]);

  const atRisk =
    detail.engagement === "Active" &&
    detail.daysSinceLastInvoice != null &&
    detail.daysSinceLastInvoice > 90;

  return (
    <>
      {/* Header */}
      <div className="bg-surface border border-rule rounded-card p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            {detail.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.logo}
                alt=""
                className="w-12 h-12 rounded object-cover bg-bg-elevated border border-rule shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-ink-strong leading-tight truncate">
                {detail.name}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-muted flex-wrap">
                {detail.engagement && (
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                      ENGAGEMENT_COLOR[detail.engagement] ?? "bg-rule text-ink-muted"
                    }`}
                  >
                    {detail.engagement}
                  </span>
                )}
                {detail.contractType && <span>{detail.contractType}</span>}
                {detail.createdYear && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <span>Since {detail.createdYear}</span>
                  </>
                )}
                {detail.hourlyRate != null && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <span className="font-mono tabnum">{fmtCurrency(detail.hourlyRate)}/hr</span>
                  </>
                )}
                {atRisk && (
                  <span className="px-2 py-0.5 bg-red-soft text-red rounded text-[10px] font-medium">
                    At risk · {detail.daysSinceLastInvoice}d
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            {detail.website && (
              <a
                href={detail.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
              >
                Website ↗
              </a>
            )}
            {detail.driveFolder && (
              <a
                href={detail.driveFolder}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
              >
                Drive ↗
              </a>
            )}
            {detail.miroFolder && (
              <a
                href={detail.miroFolder}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
              >
                Miro ↗
              </a>
            )}
            {detail.googleChat && (
              <a
                href={detail.googleChat}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
              >
                Chat ↗
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Lifetime revenue" value={fmtCurrency(detail.lifetimeRevenue)} tone="text-emerald" />
          <Stat
            label="Outstanding AR"
            value={fmtCurrency(detail.outstandingAR)}
            tone={detail.outstandingAR > 0 ? "text-red" : "text-ink-strong"}
          />
          <Stat label="Invoices" value={String(detail.invoiceCount)} sub={`${counts.all} projects`} />
          <Stat
            label="Last invoice"
            value={fmtDate(detail.lastInvoiceDate)}
            sub={detail.daysSinceLastInvoice != null ? `${detail.daysSinceLastInvoice}d ago` : undefined}
            tone={atRisk ? "text-red" : "text-ink-strong"}
          />
        </div>
      </div>

      {/* Overview + Relationship */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-surface border border-rule rounded-card p-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
            Overview
          </h2>
          <Field label="Industry" hint="Not in Airtable yet">—</Field>
          <Field label="Lead source" hint="Not in Airtable yet">—</Field>
          <Field label="Client start year">{detail.createdYear ?? "—"}</Field>
          <Field label="Loyalty / referral discounts" hint="Not in Airtable yet">—</Field>
          <Field label="NDA on file">{detail.hasNDA ? "Yes" : "No"}</Field>
          <Field label="Preferred business">{detail.preferredBusiness ?? "—"}</Field>
          <Field label="Legal address">
            {detail.legalAddress ? (
              <span className="whitespace-pre-wrap">{detail.legalAddress}</span>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Business description">
            {detail.businessDescription ? (
              <span className="whitespace-pre-wrap">{detail.businessDescription}</span>
            ) : (
              "—"
            )}
          </Field>
        </div>

        <div className="bg-surface border border-rule rounded-card p-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
            Relationship notes
          </h2>
          <div className="text-[13px] text-ink-faint italic py-3">
            No Relationship Notes field in Airtable yet. Add a long-text "Relationship Notes" field
            to the Companies table to surface dynamics, communication preferences, and recurring
            concerns here.
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div className="bg-surface border border-rule rounded-card mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Contacts
          </h2>
          <span className="text-[11px] font-mono text-ink-faint tabnum">
            {detail.contacts.length} {detail.contacts.length === 1 ? "person" : "people"}
          </span>
        </div>
        {detail.contacts.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-ink-muted">No contacts linked.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-elevated border-b border-rule">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Name</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Title</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Email</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Phone</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Type</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Notes</th>
                </tr>
              </thead>
              <tbody>
                {detail.contacts.map((c) => (
                  <tr key={c.id} className="border-b border-rule-soft last:border-0">
                    <td className="px-3 py-2 text-[13px] text-ink-strong">
                      {c.name}
                      {c.vip && <span className="ml-1.5 px-1.5 py-0.5 bg-violet-soft text-violet rounded text-[9px] font-medium">VIP</span>}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">{c.title ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="hover:text-emerald">{c.email}</a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted font-mono">{c.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">{c.type ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">{c.status ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted max-w-[260px] truncate" title={c.notes}>
                      {c.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Projects */}
      <div className="bg-surface border border-rule rounded-card mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-rule flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Projects
          </h2>
          <div className="flex gap-1">
            {(["active", "completed", "all"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 text-[11px] rounded font-medium uppercase tracking-wider ${
                  tab === t
                    ? "bg-emerald text-bg"
                    : "bg-bg-elevated border border-rule text-ink-muted hover:text-ink"
                }`}
              >
                {t} <span className="font-mono ml-1">{counts[t]}</span>
              </button>
            ))}
          </div>
        </div>
        {projects.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-ink-muted">No projects in this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-elevated border-b border-rule">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Project</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Deal stage</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Journey</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Prepared</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Total</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Paid</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Hours</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Stories</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedQuote(p)}
                    className="border-b border-rule-soft last:border-0 cursor-pointer hover:bg-bg-elevated transition-colors"
                  >
                    <td className="px-3 py-2 text-[13px] text-ink-strong">
                      {p.projectName}
                      {p.autonumber && (
                        <span className="ml-1.5 text-[10px] font-mono text-ink-faint">#{p.autonumber}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">{p.status ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">{p.projectStatus ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted font-mono">{fmtDate(p.preparedDate)}</td>
                    <td className="px-3 py-2 text-right text-[13px] tabnum font-semibold text-ink-strong">{fmtCurrency(p.totalCost)}</td>
                    <td className="px-3 py-2 text-right text-[12px] tabnum font-mono text-ink-muted">{fmtCurrency(p.totalPaid)}</td>
                    <td className="px-3 py-2 text-right text-[12px] tabnum font-mono text-ink-muted">
                      {p.totalHours != null ? `${p.totalHours}h` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] tabnum font-mono text-ink-muted">{p.storiesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-surface border border-rule rounded-card mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Invoices
          </h2>
          <span className="text-[11px] font-mono text-ink-faint tabnum">
            {detail.invoices.length} total
          </span>
        </div>
        {detail.invoices.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-ink-muted">No invoices on file.</div>
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
              <tbody>
                {detail.invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className="border-b border-rule-soft last:border-0 cursor-pointer hover:bg-bg-elevated transition-colors"
                  >
                    <td className="px-3 py-2 text-[12px] font-mono text-ink-muted">{inv.invoiceId ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-ink-muted">{fmtDate(inv.date)}</td>
                    <td className="px-3 py-2 text-[12px] text-ink max-w-[300px] truncate" title={inv.description ?? ""}>
                      {inv.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">{inv.type ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">{inv.status ?? "—"}</td>
                    <td className={`px-3 py-2 text-right text-[13px] tabnum font-semibold ${
                      inv.status === "paid" ? "text-emerald" :
                      inv.status === "past due" ? "text-red" : "text-ink-strong"
                    }`}>
                      {fmtCurrency(inv.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <QuoteSheet
        quote={selectedQuote}
        people={people}
        sprints={sprints}
        canEdit={canEdit}
        onClose={() => setSelectedQuote(null)}
        onFilterByClient={() => setSelectedQuote(null)}
      />
      <InvoiceSheet
        invoice={selectedInvoice}
        canEdit={canEdit}
        onClose={() => setSelectedInvoice(null)}
        onFilterByPayer={() => setSelectedInvoice(null)}
      />
    </>
  );
}
