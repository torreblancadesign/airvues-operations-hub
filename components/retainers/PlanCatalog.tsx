"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlan, setPlanActive, updatePlan } from "@/lib/mutations/retainer-tier";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  RETAINER_PRIORITIES,
  type RetainerPriority,
  type RetainerTier,
} from "@/lib/retainer-types";

type CompanyOption = { id: string; name: string };

type Draft = {
  name: string;
  rank: string;
  monthlyRate: string;
  includedHours: string;
  slaLabel: string;
  sla: Record<RetainerPriority, string>;
  custom: boolean;
  customForCompanyId: string;
};

const EMPTY: Draft = {
  name: "",
  rank: "",
  monthlyRate: "",
  includedHours: "",
  slaLabel: "",
  sla: { Urgent: "", High: "", Medium: "", Low: "" },
  custom: false,
  customForCompanyId: "",
};

function draftFrom(t: RetainerTier): Draft {
  const s = (v: number | null) => (v === null ? "" : String(v));
  return {
    name: t.name,
    rank: s(t.rank),
    monthlyRate: s(t.monthlyRate),
    includedHours: s(t.includedHours),
    slaLabel: t.slaLabel ?? "",
    sla: {
      Urgent: s(t.slaHours.Urgent),
      High: s(t.slaHours.High),
      Medium: s(t.slaHours.Medium),
      Low: s(t.slaHours.Low),
    },
    custom: t.custom,
    customForCompanyId: t.customForCompanyId ?? "",
  };
}

/** "" -> null so a cleared field blanks the column instead of writing 0. */
function numOrNull(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toInput(d: Draft) {
  return {
    name: d.name,
    rank: numOrNull(d.rank) ?? 999,
    monthlyRate: numOrNull(d.monthlyRate),
    includedHours: numOrNull(d.includedHours),
    slaLabel: d.slaLabel.trim() === "" ? null : d.slaLabel.trim(),
    slaHours: {
      Urgent: numOrNull(d.sla.Urgent),
      High: numOrNull(d.sla.High),
      Medium: numOrNull(d.sla.Medium),
      Low: numOrNull(d.sla.Low),
    },
    custom: d.custom,
    customForCompanyId: d.custom ? d.customForCompanyId || null : null,
  };
}

const input =
  "px-2 py-1 text-[12px] bg-bg-elevated border border-rule text-ink rounded focus:border-emerald focus:outline-none";

export function PlanCatalog({
  tiers,
  companies,
  canEdit,
}: {
  tiers: RetainerTier[];
  companies: CompanyOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Separate from `pending`, which only covers the router.refresh transition.
  // Without this the Save button stays live during the await and a double-click
  // creates the plan twice.
  const [busy, setBusy] = useState(false);
  const locked = busy || pending;

  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "unknown client") : null;

  function done(msg: string) {
    setError(null);
    setMessage(msg);
    setEditing(null);
    setCreating(false);
    setDraft(EMPTY);
    // router.refresh() is required — without it the client Router Cache keeps
    // serving the pre-edit page and the save appears to have done nothing.
    startTransition(() => router.refresh());
  }

  async function save() {
    if (locked) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const payload = toInput(draft);
      const res = creating
        ? await createPlan(payload)
        : await updatePlan(editing as string, payload);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const recomputed = "recomputed" in res ? res.recomputed : 0;
      done(
        recomputed > 0
          ? `Saved. ${recomputed} open request${recomputed === 1 ? "" : "s"} picked up the new response times.`
          : "Saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: RetainerTier) {
    if (locked) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await setPlanActive(t.id, !t.active);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      done(t.active ? `${t.name} retired.` : `${t.name} restored.`);
    } finally {
      setBusy(false);
    }
  }

  const catalog = tiers.filter((t) => !t.custom);
  const custom = tiers.filter((t) => t.custom);

  function editor() {
    return (
      <div className="bg-bg-elevated border border-emerald/30 rounded-card p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="eyebrow block mb-1">Plan name</span>
            <input
              className={`${input} w-full`}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1">Rank</span>
            <input
              className={`${input} w-full`}
              value={draft.rank}
              onChange={(e) => setDraft({ ...draft, rank: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1">Monthly rate</span>
            <input
              className={`${input} w-full`}
              value={draft.monthlyRate}
              onChange={(e) => setDraft({ ...draft, monthlyRate: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1">Included hours</span>
            <input
              className={`${input} w-full`}
              value={draft.includedHours}
              onChange={(e) => setDraft({ ...draft, includedHours: e.target.value })}
            />
          </label>
        </div>

        <div>
          <div className="eyebrow mb-1">
            First response, in business hours · 9am–6pm Mon–Fri Pacific
          </div>
          <div className="grid grid-cols-4 gap-3">
            {RETAINER_PRIORITIES.map((p) => (
              <label key={p} className="block">
                <span className="text-[11px] text-ink-muted block mb-1">{p}</span>
                <input
                  className={`${input} w-full`}
                  placeholder="not covered"
                  value={draft.sla[p]}
                  onChange={(e) => {
                    // Mutate a copy rather than `{ ...draft.sla, [p]: v }` — a
                    // computed union key in a spread widens the type and fails
                    // to satisfy Record<RetainerPriority, string> under strict.
                    const sla = { ...draft.sla };
                    sla[p] = e.target.value;
                    setDraft({ ...draft, sla });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            Leave blank to leave that priority uncovered. A blank never counts as a breach.
          </div>
        </div>

        <label className="block">
          <span className="eyebrow block mb-1">Client-facing SLA label</span>
          <input
            className={`${input} w-full`}
            placeholder="e.g. 2 business hours on urgent"
            value={draft.slaLabel}
            onChange={(e) => setDraft({ ...draft, slaLabel: e.target.value })}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12px] text-ink-muted flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-emerald"
              checked={draft.custom}
              onChange={(e) => setDraft({ ...draft, custom: e.target.checked })}
            />
            Custom plan for one client
          </label>
          {draft.custom && (
            <SearchableSelect
              value={draft.customForCompanyId || null}
              onChange={(v) => setDraft({ ...draft, customForCompanyId: v ?? "" })}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              allLabel="Select a client…"
            />
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={locked}
            className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium disabled:opacity-50"
          >
            {locked ? "Saving…" : "Save plan"}
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setCreating(false);
              setError(null);
            }}
            className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function row(t: RetainerTier) {
    const fmt = (v: number | null) => (v === null ? "—" : String(v));
    return (
      <tr key={t.id} className={`border-b border-rule/50 ${t.active ? "" : "opacity-50"}`}>
        <td className="px-4 py-2.5">
          <div className="text-ink-strong">{t.name}</div>
          {t.custom && (
            <div className="text-[10px] text-violet">
              custom · {companyName(t.customForCompanyId) ?? "no client — hidden everywhere"}
            </div>
          )}
          {!t.active && <div className="text-[10px] text-ink-faint">retired</div>}
        </td>
        <td className="px-3 py-2.5 text-right tabnum text-ink-muted">{fmt(t.monthlyRate)}</td>
        <td className="px-3 py-2.5 text-right tabnum text-ink-muted">{fmt(t.includedHours)}</td>
        {RETAINER_PRIORITIES.map((p) => (
          <td key={p} className="px-3 py-2.5 text-right tabnum">
            {t.slaHours[p] === null ? (
              <span
                className="text-amber"
                title="Not covered — requests at this priority are never measured"
              >
                —
              </span>
            ) : (
              <span className="text-ink">{t.slaHours[p]}h</span>
            )}
          </td>
        ))}
        <td className="px-3 py-2.5 text-right">
          {canEdit && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(t.id);
                  setDraft(draftFrom(t));
                  setMessage(null);
                  setError(null);
                }}
                className="text-[11px] text-ink-muted hover:text-emerald"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(t)}
                disabled={locked}
                className="text-[11px] text-ink-faint hover:text-amber disabled:opacity-50"
              >
                {t.active ? "Retire" : "Restore"}
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  function table(rows: RetainerTier[], heading: string, empty: string) {
    return (
      <section className="bg-surface border border-rule rounded-card mb-5">
        <div className="px-4 py-3 border-b border-rule eyebrow">{heading}</div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-ink-muted">{empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-ink-faint border-b border-rule">
                  <th className="text-left font-medium px-4 py-2">Plan</th>
                  <th className="text-right font-medium px-3 py-2">Rate</th>
                  <th className="text-right font-medium px-3 py-2">Hours</th>
                  {RETAINER_PRIORITIES.map((p) => (
                    <th key={p} className="text-right font-medium px-3 py-2">
                      {p}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>{rows.map(row)}</tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-surface border border-red/30 rounded-card px-4 py-2.5 text-[12px] text-red mb-4">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-surface border border-emerald/30 rounded-card px-4 py-2.5 text-[12px] text-emerald mb-4">
          {message}
        </div>
      )}

      {canEdit && !creating && editing === null && (
        <button
          onClick={() => {
            setCreating(true);
            setDraft(EMPTY);
            setMessage(null);
            setError(null);
          }}
          className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium mb-4"
        >
          New plan
        </button>
      )}

      {(creating || editing !== null) && <div className="mb-5">{editor()}</div>}

      {table(catalog, "Catalog", "No catalog plans yet.")}
      {table(
        custom,
        "Custom plans",
        "No custom plans. Create one and tick “Custom plan for one client”.",
      )}
    </>
  );
}
