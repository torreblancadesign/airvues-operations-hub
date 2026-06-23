"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ClientDetail } from "@/lib/client-detail";
import type { PipelineQuote } from "@/lib/pipeline";
import type { MoneyInvoice } from "@/lib/money";
import type { PersonOption } from "@/lib/quote-types";
import { QuoteSheet } from "@/components/pipeline/QuoteSheet";
import { InvoiceSheet } from "@/components/money/InvoiceSheet";
import { InlineField } from "@/components/clients/InlineField";
import { updateCompany, type CompanyPatch } from "@/lib/mutations/company";
import { updateContact, type ContactPatch } from "@/lib/mutations/person";
import { updateClientStatuses, type PartnerStatus, type LeadStatus } from "@/lib/mutations/client";

const PARTNER_STATUS_OPTIONS: PartnerStatus[] = ["Lead", "Client"];
const LEAD_STATUS_OPTIONS: LeadStatus[] = [
  "New Lead",
  "Discovery",
  "Proposal Drafting",
  "Proposal Sent",
  "Won",
  "Lost",
  "On Hold",
];

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

const ENGAGEMENT_OPTIONS = ["Active", "Occasional", "Iddle", "Lost", "New", "Archived"];
const CONTRACT_OPTIONS = ["Lump Sum", "Hourly", "Membership"];
const PREFERRED_BUSINESS_OPTIONS = ["Fiverr", "Off-the-Grid"];
const INDUSTRY_OPTIONS = [
  "SaaS", "Marketplace", "Fintech", "Healthcare", "E-commerce",
  "Real Estate", "Media", "Education", "Professional Services", "Other",
];
const LEAD_SOURCE_OPTIONS = ["Fiverr", "Word of Mouth", "Referral", "Inbound", "Outbound", "Other"];
const DISCOUNT_REASON_OPTIONS = ["Loyalty", "Referral", "Volume", "Other"];
const PERSON_TYPE_OPTIONS = ["Internal", "External", "External client/partner", "Internal team member"];
const PERSON_STATUS_OPTIONS = ["Active", "Onboarding", "Innactive", "Unknown ", "Former"];

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

export function ClientDetailView({ detail, people, sprints, canEdit }: Props) {
  const [tab, setTab] = useState<Tab>("active");
  const [selectedQuote, setSelectedQuote] = useState<PipelineQuote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<MoneyInvoice | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get("highlight") ?? null;

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`project-row-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

  const projects = useMemo(() => {
    if (tab === "all") return detail.projects;
    return detail.projects.filter((p) => projectBucket(p) === tab);
  }, [detail.projects, tab]);

  const counts = useMemo(() => {
    let active = 0, completed = 0;
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

  // Helper to bind one company-field save
  const saveCompany = <K extends keyof CompanyPatch>(key: K) =>
    (value: CompanyPatch[K]) => updateCompany(detail.id, { [key]: value } as CompanyPatch);

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
                {detail.clientStartYear && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <span>Since {detail.clientStartYear}</span>
                  </>
                )}
                {detail.hourlyRate != null && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <span className="font-mono tabnum">{fmtCurrency(detail.hourlyRate)}/hr</span>
                  </>
                )}
                {detail.discountPct != null && detail.discountPct > 0 && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <span className="px-1.5 py-0.5 bg-violet-soft text-violet rounded text-[10px] font-medium">
                      {detail.discountPct}% {detail.discountReason ?? "discount"}
                    </span>
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
              <a href={detail.website} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">
                Website ↗
              </a>
            )}
            {detail.driveFolder && (
              <a href={detail.driveFolder} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">
                Drive ↗
              </a>
            )}
            {detail.miroFolder && (
              <a href={detail.miroFolder} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">
                Miro ↗
              </a>
            )}
            {detail.googleChat && (
              <a href={detail.googleChat} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-8 bg-surface border border-rule rounded-card p-4 [&_.if-group_.border-b]:border-b-0">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-3">
            Overview
          </h2>

          <div className="if-group">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint mb-1">Identity</div>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <InlineField
                kind="select" label="Industry" value={detail.industry} options={INDUSTRY_OPTIONS}
                readOnly={!canEdit} onSave={saveCompany("industry")}
              />
              <InlineField
                kind="select" label="Lead source" value={detail.leadSource} options={LEAD_SOURCE_OPTIONS}
                readOnly={!canEdit} onSave={saveCompany("leadSource")}
              />
              <InlineField
                kind="number" label="Client start year"
                value={detail.clientStartYearOverride}
                step={1}
                placeholder={detail.createdYear ? `auto: ${detail.createdYear}` : "—"}
                hint={detail.createdYear && !detail.clientStartYearOverride ? `auto from created: ${detail.createdYear}` : undefined}
                readOnly={!canEdit} onSave={saveCompany("clientStartYear")}
              />
              <InlineField
                kind="select" label="Preferred business" value={detail.preferredBusiness} options={PREFERRED_BUSINESS_OPTIONS}
                readOnly={!canEdit} onSave={saveCompany("preferredBusiness")}
              />
            </div>
          </div>

          <div className="if-group mt-3 pt-3 border-t border-rule">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint mb-1">Commercial</div>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <InlineField
                kind="select" label="Contract type" value={detail.contractType} options={CONTRACT_OPTIONS}
                readOnly={!canEdit} onSave={saveCompany("contractType")}
              />
              <InlineField
                kind="number" label="Hourly rate" value={detail.hourlyRate} step={1} suffix=" USD"
                readOnly={!canEdit} onSave={saveCompany("hourlyRate")}
              />
              <InlineField
                kind="number" label="Discount %" value={detail.discountPct} step={1} suffix="%"
                readOnly={!canEdit} onSave={saveCompany("discountPct")}
              />
              <InlineField
                kind="select" label="Discount reason" value={detail.discountReason} options={DISCOUNT_REASON_OPTIONS}
                readOnly={!canEdit} onSave={saveCompany("discountReason")}
              />
              <InlineField
                kind="bool" label="NDA on file" value={detail.hasNDA}
                readOnly={!canEdit} onSave={saveCompany("hasNDA")}
              />
            </div>
          </div>

          <div className="if-group mt-3 pt-3 border-t border-rule">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint mb-1">Status</div>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <InlineField
                kind="select" label="Engagement frequency" value={detail.engagement} options={ENGAGEMENT_OPTIONS}
                readOnly={!canEdit} onSave={saveCompany("engagementFrequency")}
              />
              <InlineField
                kind="select" label="Partner status" value={detail.partnerStatus}
                options={PARTNER_STATUS_OPTIONS as unknown as string[]}
                readOnly={!canEdit || !detail.primaryContactId}
                hint={!detail.primaryContactId ? "no primary contact" : `on ${detail.contacts[0]?.name ?? "contact"}`}
                onSave={async (v) => {
                  if (!detail.primaryContactId) return { error: "No primary contact to update" };
                  return updateClientStatuses({
                    clientId: detail.primaryContactId,
                    partnerStatus: (v as PartnerStatus | null) ?? null,
                  });
                }}
              />
              <InlineField
                kind="select" label="Lead status" value={detail.leadStatus}
                options={LEAD_STATUS_OPTIONS as unknown as string[]}
                readOnly={!canEdit || !detail.primaryContactId}
                hint={!detail.primaryContactId ? "no primary contact" : undefined}
                onSave={async (v) => {
                  if (!detail.primaryContactId) return { error: "No primary contact to update" };
                  return updateClientStatuses({
                    clientId: detail.primaryContactId,
                    leadStatus: (v as LeadStatus | null) ?? null,
                  });
                }}
              />
            </div>
          </div>

          <div className="if-group mt-3 pt-3 border-t border-rule">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint mb-1">Links</div>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <InlineField
                kind="url" label="Website" value={detail.website}
                readOnly={!canEdit} onSave={saveCompany("website")}
              />
              <InlineField
                kind="url" label="Drive folder" value={detail.driveFolder}
                readOnly={!canEdit} onSave={saveCompany("driveFolder")}
              />
              <InlineField
                kind="url" label="Miro folder" value={detail.miroFolder}
                readOnly={!canEdit} onSave={saveCompany("miroFolder")}
              />
              <InlineField
                kind="url" label="Google Chat" value={detail.googleChat}
                readOnly={!canEdit} onSave={saveCompany("googleChat")}
              />
            </div>
          </div>

          <div className="if-group mt-3 pt-3 border-t border-rule">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint mb-1">Address & description</div>
            <InlineField
              kind="textarea" label="Legal address" value={detail.legalAddress ?? ""} rows={2}
              readOnly={!canEdit} onSave={(v) => updateCompany(detail.id, { legalAddress: v || null })}
            />
            <InlineField
              kind="textarea" label="Business description" value={detail.businessDescription} rows={4}
              readOnly={!canEdit} onSave={(v) => updateCompany(detail.id, { businessDescription: v })}
            />
          </div>
        </div>

        <div className="lg:col-span-4 bg-surface border border-rule rounded-card p-4 lg:sticky lg:top-4 self-start">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
            Relationship notes
          </h2>
          <div className="text-[11px] text-ink-faint mb-2">
            How they like to be worked with — communication, dynamics, recurring concerns.
          </div>
          <InlineField
            kind="textarea" label="Notes" value={detail.relationshipNotes} rows={10}
            placeholder="Add context about how this client likes to be worked with…"
            readOnly={!canEdit} onSave={(v) => updateCompany(detail.id, { relationshipNotes: v })}
          />
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
                  {canEdit && <th className="px-3 py-2 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {detail.contacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    canEdit={canEdit}
                    expanded={editingContactId === c.id}
                    onToggle={() => setEditingContactId(editingContactId === c.id ? null : c.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Projects */}
      <div id="projects-section" className="bg-surface border border-rule rounded-card mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-rule flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Projects
          </h2>
          <div className="flex items-center gap-2">
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
            {canEdit && (
              <a
                href={`/clients/${detail.id}/proposals/new`}
                className="px-3 py-1 text-[11px] rounded font-medium uppercase tracking-wider bg-emerald text-bg hover:bg-emerald/80"
                title="Create a new proposal for this account"
              >
                + New proposal
              </a>
            )}
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
                    id={`project-row-${p.id}`}
                    onClick={() => { window.location.href = `/pipeline/${p.id}`; }}
                    className={`border-b border-rule-soft last:border-0 cursor-pointer hover:bg-bg-elevated transition-colors ${
                      highlightId === p.id ? "bg-emerald-soft/40 ring-1 ring-emerald" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-[13px] text-ink-strong">
                      <a href={`/pipeline/${p.id}`} className="hover:text-emerald hover:underline">
                        {p.projectName}
                      </a>
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

function ContactRow({
  contact,
  canEdit,
  expanded,
  onToggle,
}: {
  contact: ClientDetail["contacts"][number];
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const save = <K extends keyof ContactPatch>(key: K) =>
    (value: ContactPatch[K]) => updateContact(contact.id, { [key]: value } as ContactPatch);

  return (
    <>
      <tr className="border-b border-rule-soft">
        <td className="px-3 py-2 text-[13px] text-ink-strong">
          {contact.name}
          {contact.vip && <span className="ml-1.5 px-1.5 py-0.5 bg-violet-soft text-violet rounded text-[9px] font-medium">VIP</span>}
        </td>
        <td className="px-3 py-2 text-[12px] text-ink-muted">{contact.title ?? "—"}</td>
        <td className="px-3 py-2 text-[12px] text-ink-muted">
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="hover:text-emerald">{contact.email}</a>
          ) : "—"}
        </td>
        <td className="px-3 py-2 text-[12px] text-ink-muted font-mono">{contact.phone ?? "—"}</td>
        <td className="px-3 py-2 text-[12px] text-ink-muted">{contact.type ?? "—"}</td>
        <td className="px-3 py-2 text-[12px] text-ink-muted">{contact.status ?? "—"}</td>
        <td className="px-3 py-2 text-[12px] text-ink-muted max-w-[260px] truncate" title={contact.notes}>
          {contact.notes || "—"}
        </td>
        {canEdit && (
          <td className="px-3 py-2 text-right">
            <button
              onClick={onToggle}
              className="text-[11px] text-ink-muted hover:text-emerald font-medium"
            >
              {expanded ? "Close" : "Edit"}
            </button>
          </td>
        )}
      </tr>
      {expanded && canEdit && (
        <tr className="border-b border-rule-soft bg-bg-elevated">
          <td colSpan={8} className="px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <InlineField kind="text" label="Title / Role" value={contact.title} onSave={save("title")} />
              <InlineField kind="text" label="Email" value={contact.email} onSave={save("email")} />
              <InlineField kind="text" label="Phone" value={contact.phone} onSave={save("phone")} />
              <InlineField kind="select" label="Type" value={contact.type} options={PERSON_TYPE_OPTIONS} onSave={save("type")} />
              <InlineField kind="select" label="Status" value={contact.status} options={PERSON_STATUS_OPTIONS} onSave={save("status")} />
              <InlineField kind="bool" label="VIP" value={contact.vip} onSave={save("vip")} />
              <div className="md:col-span-2">
                <InlineField kind="textarea" label="Notes" value={contact.notes} rows={3} onSave={save("notes")} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
