"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRetainerArchived, updateRetainer } from "@/lib/mutations/retainer";
import { createPlan } from "@/lib/mutations/retainer-tier";
import { plansAvailableFor, legacyTierChoiceFor } from "@/lib/retainer-catalog";
import {
  RETAINER_PRIORITIES,
  type RetainerAgreement,
  type RetainerPriority,
  type RetainerTier,
} from "@/lib/retainer-types";

const chip =
  "inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider";
const input =
  "px-2 py-1 text-[12px] bg-bg-elevated border border-rule text-ink rounded focus:border-emerald focus:outline-none";

function money(n: number | null): string {
  return n == null ? "—" : `$${n.toLocaleString()}`;
}
function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}
function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  agreement: RetainerAgreement;
  tier: RetainerTier | null;
  /** Every plan, active and inactive. Scoping happens here via plansAvailableFor. */
  tiers: RetainerTier[];
  periodStart: string | null;
  periodEnd: string | null;
  canEdit: boolean;
  /** Legacy singleSelect on the quote, so we can warn when it disagrees. */
  legacySelectedTier: string | null;
};

export function RetainerTerms({
  agreement,
  tier,
  tiers,
  periodStart,
  periodEnd,
  canEdit,
  legacySelectedTier,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const locked = busy || pending;

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState(agreement.projectName);
  const [tierId, setTierId] = useState<string>(agreement.tierId ?? "");
  const [rate, setRate] = useState(
    agreement.monthlyRate === null ? "" : String(agreement.monthlyRate),
  );
  const [hours, setHours] = useState(
    agreement.includedHours === null ? "" : String(agreement.includedHours),
  );
  const [term, setTerm] = useState(
    agreement.termMonths === null ? "" : String(agreement.termMonths),
  );
  const [effective, setEffective] = useState(agreement.effectiveDate ?? "");
  const [active, setActive] = useState(agreement.subscriptionActive);

  // Inline custom-plan creation, scoped to this client.
  const [makingPlan, setMakingPlan] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planRate, setPlanRate] = useState("");
  const [planHours, setPlanHours] = useState("");
  const [planSla, setPlanSla] = useState<Record<RetainerPriority, string>>({
    Urgent: "",
    High: "",
    Medium: "",
    Low: "",
  });

  const options = plansAvailableFor(tiers, agreement.companyId);
  // A retired plan this retainer still sits on is not in `options` — show it
  // anyway so switching away is possible without silently reassigning them.
  const showsCurrent = tier !== null && !options.some((t) => t.id === tier.id);

  const picked = tierId ? (tiers.find((t) => t.id === tierId) ?? null) : null;

  function reset() {
    setName(agreement.projectName);
    setTierId(agreement.tierId ?? "");
    setRate(agreement.monthlyRate === null ? "" : String(agreement.monthlyRate));
    setHours(agreement.includedHours === null ? "" : String(agreement.includedHours));
    setTerm(agreement.termMonths === null ? "" : String(agreement.termMonths));
    setEffective(agreement.effectiveDate ?? "");
    setActive(agreement.subscriptionActive);
    setMakingPlan(false);
    setError(null);
  }

  function refresh(msg: string) {
    setError(null);
    setMessage(msg);
    setEditing(false);
    setMakingPlan(false);
    // Without router.refresh the client Router Cache keeps serving the
    // pre-edit page and the save looks like it did nothing.
    startTransition(() => router.refresh());
  }

  /** Picking a plan prefills rate and hours, but they stay editable — the
   *  negotiated number on the agreement always wins over the catalog number. */
  function choosePlan(id: string) {
    setTierId(id);
    const t = tiers.find((x) => x.id === id);
    if (!t) return;
    if (rate.trim() === "" && t.monthlyRate !== null) setRate(String(t.monthlyRate));
    if (hours.trim() === "" && t.includedHours !== null) setHours(String(t.includedHours));
  }

  async function save() {
    if (locked) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await updateRetainer(agreement.id, {
        projectName: name,
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
      refresh("Retainer updated.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchived() {
    if (locked) return;
    setError(null);
    setBusy(true);
    try {
      const res = await setRetainerArchived(agreement.id, !agreement.archived);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      refresh(
        agreement.archived
          ? "Retainer restored to the board."
          : "Retainer archived. Nothing was deleted — its requests and stories are intact.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveCustomPlan() {
    if (locked) return;
    if (!agreement.companyId) {
      setError("This retainer has no client linked, so a custom plan cannot be scoped to one.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await createPlan({
        name: planName,
        rank: 900,
        monthlyRate: numOrNull(planRate),
        includedHours: numOrNull(planHours),
        slaHours: {
          Urgent: numOrNull(planSla.Urgent),
          High: numOrNull(planSla.High),
          Medium: numOrNull(planSla.Medium),
          Low: numOrNull(planSla.Low),
        },
        custom: true,
        customForCompanyId: agreement.companyId,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Link it immediately — creating a plan from inside a retainer and then
      // having to go find it in a picker would be a pointless second step.
      const link = await updateRetainer(agreement.id, { tierId: res.id });
      if ("error" in link) {
        setError(`Plan created but not linked: ${link.error}`);
        return;
      }
      refresh(`Custom plan “${planName}” created and linked.`);
    } finally {
      setBusy(false);
    }
  }

  const legacyMismatch =
    tier !== null &&
    legacySelectedTier !== null &&
    legacyTierChoiceFor(tier.name) === null &&
    legacySelectedTier !== tier.name;

  if (!editing) {
    return (
      <section
        className={`bg-surface border rounded-card p-4 ${
          agreement.archived ? "border-amber/40" : "border-rule"
        }`}
      >
        {message && <div className="mb-3 text-[12px] text-emerald">{message}</div>}
        {error && <div className="mb-3 text-[12px] text-red">{error}</div>}
        {agreement.archived && (
          <div className="mb-3 text-[12px] text-amber">
            Archived — hidden from the retainers board. Every request, comment and story is
            still linked and nothing was deleted. Restore to bring it back.
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 flex-1">
            <div>
              <div className="eyebrow mb-1">Plan</div>
              <div className="text-[14px] text-ink-strong">{tier?.name ?? "— none —"}</div>
              {tier?.slaLabel && (
                <div className="text-[10px] text-ink-faint">{tier.slaLabel}</div>
              )}
              {tier && !tier.active && (
                <div className="text-[10px] text-amber">retired plan</div>
              )}
            </div>
            <div>
              <div className="eyebrow mb-1">Monthly</div>
              <div className="text-[14px] text-ink-strong tabnum">
                {money(agreement.monthlyRate ?? tier?.monthlyRate ?? null)}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Included hrs</div>
              <div className="text-[14px] text-ink-strong tabnum">
                {agreement.includedHours ?? tier?.includedHours ?? "—"}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Effective</div>
              <div className="text-[14px] text-ink-strong font-mono">
                {shortDate(agreement.effectiveDate)}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">This period</div>
              <div className="text-[12px] text-ink-strong font-mono">
                {periodStart && periodEnd
                  ? `${periodStart.slice(5, 10)} → ${periodEnd.slice(5, 10)}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Subscription</div>
              <span
                className={`${chip} ${
                  agreement.subscriptionActive
                    ? "bg-emerald/15 text-emerald"
                    : "bg-bg-elevated text-ink-muted"
                }`}
              >
                {agreement.subscriptionActive ? "Active" : (agreement.dealStatus ?? "—")}
              </span>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  reset();
                  setEditing(true);
                  setMessage(null);
                }}
                className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted hover:text-emerald hover:border-emerald"
              >
                Edit terms
              </button>
              <button
                onClick={toggleArchived}
                disabled={locked}
                className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-faint hover:text-amber hover:border-amber disabled:opacity-50"
              >
                {agreement.archived ? "Restore" : "Archive"}
              </button>
            </div>
          )}
        </div>

        {tier && (
          <div className="mt-3 pt-3 border-t border-rule/50 flex flex-wrap gap-4">
            <div className="eyebrow">First response</div>
            {RETAINER_PRIORITIES.map((p) => (
              <div key={p} className="text-[11px]">
                <span className="text-ink-muted">{p}: </span>
                {tier.slaHours[p] === null ? (
                  <span className="text-amber">not covered</span>
                ) : (
                  <span className="text-ink tabnum">{tier.slaHours[p]}h</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!tier && (
          <p className="mt-3 text-[11px] text-amber">
            No plan linked, so no response deadline is calculated. Requests are tracked but
            reported as “Not covered”.{" "}
            {canEdit && "Use Edit terms to assign one."}
          </p>
        )}

        {legacyMismatch && (
          <p className="mt-2 text-[11px] text-amber">
            The quote’s legacy “Retainer Selected Tier” still reads{" "}
            <strong>{legacySelectedTier}</strong> while the linked plan is{" "}
            <strong>{tier?.name}</strong>. Custom plans have no legacy equivalent, so it was
            left alone rather than blanked — whatever renders the client’s document may still
            show the old name.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="bg-surface border border-emerald/30 rounded-card p-4 space-y-3">
      {error && <div className="text-[12px] text-red">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block lg:col-span-2">
          <span className="eyebrow block mb-1">Retainer name</span>
          <input className={`${input} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Client</span>
          <div className="text-[12px] text-ink-muted py-1">
            {agreement.companyName ?? "— none —"}
          </div>
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
          >
            <option value="">— no plan —</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.custom ? " (custom)" : ""}
              </option>
            ))}
            {showsCurrent && tier && (
              <option value={tier.id}>{tier.name} (retired)</option>
            )}
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

      {picked && (
        <div className="text-[11px] text-ink-muted">
          {picked.name} response times:{" "}
          {RETAINER_PRIORITIES.map((p) => (
            <span key={p} className="mr-3">
              {p}{" "}
              {picked.slaHours[p] === null ? (
                <span className="text-amber">not covered</span>
              ) : (
                <span className="text-ink tabnum">{picked.slaHours[p]}h</span>
              )}
            </span>
          ))}
        </div>
      )}

      <label className="text-[12px] text-ink-muted flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-emerald"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Subscription active
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={locked}
          className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium disabled:opacity-50"
        >
          {locked ? "Saving…" : "Save terms"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            reset();
          }}
          className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted"
        >
          Cancel
        </button>
        {!makingPlan && (
          <button
            onClick={() => setMakingPlan(true)}
            className="ml-auto text-[11px] text-ink-muted hover:text-emerald underline"
          >
            Create a custom plan for {agreement.companyName ?? "this client"}
          </button>
        )}
      </div>

      {makingPlan && (
        <div className="border-t border-rule pt-3 space-y-3">
          <div className="eyebrow">
            New custom plan — only {agreement.companyName ?? "this client"} can be put on it
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[11px] text-ink-muted block mb-1">Plan name</span>
              <input
                className={`${input} w-full`}
                placeholder={`${agreement.companyName ?? "Client"} — Custom`}
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted block mb-1">Monthly rate</span>
              <input
                className={`${input} w-full`}
                value={planRate}
                onChange={(e) => setPlanRate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted block mb-1">Included hours</span>
              <input
                className={`${input} w-full`}
                value={planHours}
                onChange={(e) => setPlanHours(e.target.value)}
              />
            </label>
          </div>
          <div>
            <div className="text-[11px] text-ink-muted mb-1">
              First response, business hours · blank = not covered
            </div>
            <div className="grid grid-cols-4 gap-3">
              {RETAINER_PRIORITIES.map((p) => (
                <label key={p} className="block">
                  <span className="text-[11px] text-ink-muted block mb-1">{p}</span>
                  <input
                    className={`${input} w-full`}
                    value={planSla[p]}
                    onChange={(e) => {
                      const next = { ...planSla };
                      next[p] = e.target.value;
                      setPlanSla(next);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveCustomPlan}
              disabled={locked}
              className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium disabled:opacity-50"
            >
              {locked ? "Creating…" : "Create and link"}
            </button>
            <button
              onClick={() => setMakingPlan(false)}
              className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
