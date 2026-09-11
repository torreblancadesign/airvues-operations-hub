"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRetainerArchived, updateRetainer } from "@/lib/mutations/retainer";
import { DeleteControl } from "@/components/ui/DeleteControl";
import { useCanDelete } from "@/components/DeletePermission";
import { createPlan } from "@/lib/mutations/retainer-tier";
import { PeriodMeter } from "./Meters";
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
  const canDelete = useCanDelete();
  // Client-side clock: the period bar is time-dependent and would otherwise
  // hydrate mismatched against the server render.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);

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
    if (locked) return { error: "Retainer is locked." };
    setError(null);
    setBusy(true);
    try {
      const res = await setRetainerArchived(agreement.id, !agreement.archived);
      if ("error" in res) {
        setError(res.error);
        return res;
      }
      refresh(
        agreement.archived
          ? "Retainer restored to the board."
          : "Retainer archived. Nothing was deleted — its requests and stories are intact.",
      );
      return res;
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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[17px] font-semibold text-ink-strong leading-tight">
                {tier?.name ?? "No plan linked"}
              </h2>
              <span
                className={`${chip} ${
                  agreement.subscriptionActive
                    ? "bg-emerald/15 text-emerald"
                    : "bg-bg-elevated text-ink-muted"
                }`}
              >
                {agreement.subscriptionActive ? "Active" : (agreement.dealStatus ?? "Not active")}
              </span>
              {tier && !tier.active && (
                <span className={`${chip} bg-amber/15 text-amber`}>retired plan</span>
              )}
              {tier?.custom && (
                <span className={`${chip} bg-violet/15 text-violet`}>custom</span>
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-3 flex-wrap text-[13px]">
              <span className="tabnum text-ink-strong font-medium">
                {money(agreement.monthlyRate ?? tier?.monthlyRate ?? null)}
              </span>
              <span className="text-ink-faint">/ month</span>
              <span className="text-rule-strong">·</span>
              <span className="tabnum text-ink-strong font-medium">
                {agreement.includedHours ?? tier?.includedHours ?? "—"}h
              </span>
              <span className="text-ink-faint">included</span>
              {agreement.termMonths !== null && (
                <>
                  <span className="text-rule-strong">·</span>
                  <span className="tabnum text-ink-muted">{agreement.termMonths}-month term</span>
                </>
              )}
            </div>
            <div className="mt-1 text-[11px] text-ink-faint tabnum">
              effective {shortDate(agreement.effectiveDate)}
              {agreement.contactName && ` · ${agreement.contactName}`}
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
                className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted hover:text-emerald hover:border-emerald transition-colors"
              >
                Edit terms
              </button>
              {agreement.archived ? (
                // Restoring is safe — only the archive direction needs a confirm.
                canDelete && (
                  <button
                    onClick={toggleArchived}
                    disabled={locked}
                    className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-faint hover:text-amber hover:border-amber disabled:opacity-50 transition-colors"
                  >
                    Restore
                  </button>
                )
              ) : (
                canDelete && (
                  <DeleteControl
                    variant="archive"
                    label="Archive"
                    question="Archive this retainer?"
                    confirmLabel="Yes, archive"
                    consequence="It leaves the retainer board. Requests, comments, stories and invoices are untouched, and Restore brings it back."
                    onConfirm={toggleArchived}
                  />
                )
              )}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-rule/60 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="eyebrow mb-2">
              First response promised · business hours, 9–6 Mon–Fri Pacific
            </div>
            {tier ? (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {RETAINER_PRIORITIES.map((p) => (
                  <div key={p}>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider">{p}</div>
                    {tier.slaHours[p] === null ? (
                      <div className="text-[14px] text-amber leading-tight">not covered</div>
                    ) : (
                      <div className="text-[16px] text-ink-strong font-semibold tabnum leading-tight">
                        {tier.slaHours[p]}
                        <span className="text-[12px] text-ink-faint font-normal">h</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-amber leading-snug max-w-md">
                No plan is linked, so no deadline is calculated. Requests are still recorded and
                answered — they are just reported as “Not covered” and can never count as a
                breach.{canEdit && " Use Edit terms to assign a plan."}
              </p>
            )}
          </div>

          <div className="sm:w-[180px] sm:border-l sm:border-rule/60 sm:pl-5">
            <div className="eyebrow mb-2">This period</div>
            {periodStart && periodEnd ? (
              <PeriodMeter start={periodStart} end={periodEnd} now={nowMs ?? Date.parse(periodStart)} />
            ) : (
              <div className="text-[11px] text-ink-faint">
                No effective date, so no billing period is tracked.
              </div>
            )}
          </div>
        </div>

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
