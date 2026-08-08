"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRetainer } from "@/lib/mutations/retainer";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { plansAvailableFor } from "@/lib/retainer-catalog";
import type { RetainerTier } from "@/lib/retainer-types";

type CompanyOption = { id: string; name: string };

const input =
  "px-2 py-1 text-[12px] bg-bg-elevated border border-rule text-ink rounded focus:border-emerald focus:outline-none";

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function NewRetainerButton({
  companies,
  tiers,
}: {
  companies: CompanyOption[];
  tiers: RetainerTier[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const locked = busy || pending;

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [tierId, setTierId] = useState("");
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");
  const [term, setTerm] = useState("12");
  const [effective, setEffective] = useState("");
  const [active, setActive] = useState(true);

  // Plans offered depend on the client picked — a custom plan belongs to one.
  const options = plansAvailableFor(tiers, companyId || null);

  function choosePlan(id: string) {
    setTierId(id);
    const t = tiers.find((x) => x.id === id);
    if (!t) return;
    if (rate.trim() === "" && t.monthlyRate !== null) setRate(String(t.monthlyRate));
    if (hours.trim() === "" && t.includedHours !== null) setHours(String(t.includedHours));
  }

  function chooseCompany(id: string) {
    setCompanyId(id);
    // A plan scoped to the previous client must not survive the switch.
    if (tierId) {
      const stillOffered = plansAvailableFor(tiers, id || null).some((t) => t.id === tierId);
      if (!stillOffered) setTierId("");
    }
    if (name.trim() === "") {
      const c = companies.find((x) => x.id === id);
      if (c) setName(`${c.name} Retainer`);
    }
  }

  async function submit() {
    if (locked) return;
    setError(null);
    setBusy(true);
    try {
      const res = await createRetainer({
        projectName: name,
        companyId,
        tierId: tierId === "" ? null : tierId,
        monthlyRate: numOrNull(rate),
        includedHours: numOrNull(hours),
        termMonths: numOrNull(term),
        effectiveDate: effective.trim() === "" ? null : effective.trim(),
        active,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      startTransition(() => {
        router.refresh();
        router.push(`/retainers/${res.id}`);
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium"
      >
        New retainer
      </button>
    );
  }

  return (
    <section className="bg-surface border border-emerald/30 rounded-card p-4 space-y-3 mb-4">
      <div className="eyebrow">New retainer</div>
      {error && <div className="text-[12px] text-red">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="block">
          <span className="eyebrow block mb-1">Client</span>
          <SearchableSelect
            value={companyId || null}
            onChange={(v) => chooseCompany(v ?? "")}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            allLabel="Select a client…"
          />
        </div>
        <label className="block lg:col-span-2">
          <span className="eyebrow block mb-1">Retainer name</span>
          <input
            className={`${input} w-full`}
            placeholder="e.g. Gracie Barra Retainer"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Effective date</span>
          <input
            type="date"
            className={`${input} w-full`}
            value={effective}
            onChange={(e) => setEffective(e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block">
          <span className="eyebrow block mb-1">Plan</span>
          <select
            className={`${input} w-full`}
            value={tierId}
            onChange={(e) => choosePlan(e.target.value)}
            disabled={!companyId}
          >
            <option value="">— no plan —</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.custom ? " (custom)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Monthly rate</span>
          <input className={`${input} w-full`} value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Included hours</span>
          <input className={`${input} w-full`} value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Term (months)</span>
          <input className={`${input} w-full`} value={term} onChange={(e) => setTerm(e.target.value)} />
        </label>
      </div>

      <label className="text-[12px] text-ink-muted flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-emerald"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Activate the subscription now
      </label>

      <div className="text-[11px] text-ink-faint">
        Creates a quote with Proposal Type “Retainer Agreement”. The effective date drives the
        monthly anniversary period used for hours and SLA reporting.
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={locked || !companyId}
          className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium disabled:opacity-50"
        >
          {locked ? "Creating…" : "Create retainer"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
