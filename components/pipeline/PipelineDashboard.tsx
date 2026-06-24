"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineQuote } from "@/lib/pipeline";
import { PipelineFilterBar } from "./FilterBar";
import { QuoteTable } from "./QuoteTable";
import { QuoteSheet } from "./QuoteSheet";
import { DEFAULT_SORT, EMPTY_FILTER, Filter, Sort, StageBucket } from "./types";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const STAGE_STATUSES: Record<StageBucket, string[]> = {
  all: [],
  draft: ["Draft"],
  sent: ["Sent. Awaiting Approval."],
  signed: ["Approved and Signed", "Awaiting Payment", "Project In Progress"],
  paid: ["Paid"],
  lost: ["Cancelled", "Rejected"],
  auditing: ["Auditing 🚩"],
};

const STAGE_TABS: { key: StageBucket; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent · Awaiting" },
  { key: "signed", label: "Signed" },
  { key: "paid", label: "Paid" },
  { key: "auditing", label: "Auditing" },
  { key: "lost", label: "Cancelled / Rejected" },
];

function daysSince(iso: string | null): number {
  if (!iso) return -1;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function applyFilter(rows: PipelineQuote[], f: Filter): PipelineQuote[] {
  return rows.filter((r) => {
    if (!f.showRejected && (r.status === "Rejected" || r.status === "Cancelled")) {
      if (f.stage !== "lost") return false;
    }
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${r.projectName} ${r.client} ${r.preparedBy} ${r.autonumber ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.stage !== "all") {
      const allowed = STAGE_STATUSES[f.stage];
      if (!r.status || !allowed.includes(r.status)) return false;
    }
    if (f.proposalType !== "all" && r.proposalType !== f.proposalType) return false;
    if (f.client && r.client !== f.client) return false;
    if (f.preparedBy && r.preparedBy !== f.preparedBy) return false;
    if (f.from && r.preparedDate && r.preparedDate < f.from) return false;
    if (f.to && r.preparedDate && r.preparedDate > f.to) return false;
    if (f.stalledOnly) {
      const days = daysSince(r.preparedDate);
      const isOpen = r.status === "Sent. Awaiting Approval." || r.status === "Draft" || r.status === "Auditing 🚩";
      if (!(isOpen && days > 14)) return false;
    }
    if (f.deadlineRisk !== "all") {
      if (f.deadlineRisk === "needs-attention") {
        if (r.deadlineRisk === "ok") return false;
      } else if (r.deadlineRisk !== f.deadlineRisk) {
        return false;
      }
    }
    return true;
  });
}

function applySort(rows: PipelineQuote[], s: Sort): PipelineQuote[] {
  const dir = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (s.key) {
      case "preparedDate":
        av = a.preparedDate ?? "";
        bv = b.preparedDate ?? "";
        break;
      case "totalCost":
        av = a.totalCost;
        bv = b.totalCost;
        break;
      case "client":
        av = a.client.toLowerCase();
        bv = b.client.toLowerCase();
        break;
      case "status":
        av = a.status ?? "";
        bv = b.status ?? "";
        break;
      case "autonumber":
        av = a.autonumber ?? 0;
        bv = b.autonumber ?? 0;
        break;
      case "daysSinceSent":
        av = daysSince(a.preparedDate);
        bv = daysSince(b.preparedDate);
        break;
      case "uninvoiced":
        av = a.uninvoiced;
        bv = b.uninvoiced;
        break;
      case "invoiced":
        av = a.invoiced;
        bv = b.invoiced;
        break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

import type { PersonOption } from "@/lib/quote-types";

type SprintOption = { id: string; number: number | null; status: string | null };

type Props = {
  quotes: PipelineQuote[];
  people: PersonOption[];
  sprints: SprintOption[];
  canEdit: boolean;
  initialFilter?: Partial<Filter>;
};

export function PipelineDashboard({ quotes, people, sprints, canEdit, initialFilter }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>({ ...EMPTY_FILTER, ...(initialFilter ?? {}) });
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [selected, setSelected] = useState<PipelineQuote | null>(null);

  const clients = useMemo(() => {
    const s = new Set<string>();
    for (const q of quotes) if (q.client) s.add(q.client);
    return Array.from(s).sort();
  }, [quotes]);

  const preparers = useMemo(() => {
    const s = new Set<string>();
    for (const q of quotes) if (q.preparedBy && q.preparedBy !== "—") s.add(q.preparedBy);
    return Array.from(s).sort();
  }, [quotes]);

  const filtered = useMemo(() => applyFilter(quotes, filter), [quotes, filter]);
  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort]);
  const filteredTotal = filtered.reduce((s, r) => s + r.totalCost, 0);

  const filterActive =
    !!filter.search ||
    filter.proposalType !== "all" ||
    !!filter.client ||
    !!filter.preparedBy ||
    !!filter.from ||
    !!filter.to ||
    filter.stalledOnly ||
    filter.deadlineRisk !== "all" ||
    filter.showRejected;

  // Count quotes per Deal Stage tab — apply non-stage filters so counts reflect current view.
  const baseForCounts = useMemo(() => {
    const f = { ...filter, stage: "all" as StageBucket };
    return applyFilter(quotes, f);
  }, [quotes, filter]);

  const tabCounts = useMemo(() => {
    const counts: Record<StageBucket, number> = {
      all: baseForCounts.length, draft: 0, sent: 0, signed: 0, paid: 0, lost: 0, auditing: 0,
    };
    for (const r of baseForCounts) {
      for (const tab of STAGE_TABS) {
        if (tab.key === "all") continue;
        if (r.status && STAGE_STATUSES[tab.key].includes(r.status)) counts[tab.key]++;
      }
    }
    return counts;
  }, [baseForCounts]);

  return (
    <>
      {/* Deal Stage tabs */}
      <div className="mb-3 flex items-center gap-1 flex-wrap border-b border-rule">
        {STAGE_TABS.map((t) => {
          const active = filter.stage === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter({ ...filter, stage: t.key })}
              className={`px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-emerald text-ink-strong"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full text-[10px] font-mono tabnum ${
                active ? "bg-emerald-soft text-emerald" : "bg-bg-elevated text-ink-faint"
              }`}>
                {tabCounts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <PipelineFilterBar
        filter={filter}
        setFilter={setFilter}
        clients={clients}
        preparers={preparers}
        totalCount={quotes.length}
        filteredCount={filtered.length}
      />

      {filterActive && (
        <div className="mb-3 text-[12px] text-ink-muted">
          Filtered total: <span className="text-ink-strong font-semibold tabnum">{fmtCurrency(filteredTotal)}</span>
        </div>
      )}

      <QuoteTable
        rows={sorted}
        sort={sort}
        setSort={setSort}
        onRowClick={(q) => router.push(`/pipeline/${q.id}`)}
        selectedId={selected?.id ?? null}
      />

      <QuoteSheet
        quote={selected}
        people={people}
        sprints={sprints}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onFilterByClient={(client) => {
          setFilter({ ...EMPTY_FILTER, client });
          setSelected(null);
        }}
      />
    </>
  );
}
