"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RequestThread } from "./RequestThread";
import {
  createRetainerRequest,
  triageRequestToStory,
  updateRetainerRequest,
} from "@/lib/mutations/retainer-request";
import {
  RETAINER_PRIORITIES,
  REQUEST_STATUSES,
  type RetainerAgreement,
  type RetainerComment,
  type RetainerPriority,
  type RetainerRequest,
  type RetainerTier,
  type RequestStatus,
} from "@/lib/retainer-types";
import type { PersonOption } from "@/lib/quote-types";

const chip =
  "inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider";

function priorityTone(p: string | null): string {
  if (p === "Urgent") return "bg-red/15 text-red";
  if (p === "High") return "bg-amber/15 text-amber";
  if (p === "Medium") return "bg-sky/15 text-sky";
  return "bg-bg-elevated text-ink-muted";
}

function outcomeTone(o: string | null): string {
  if (o === "Breached") return "bg-red/15 text-red";
  if (o === "Met") return "bg-emerald/15 text-emerald";
  if (o === "Pending") return "bg-sky/15 text-sky";
  return "bg-bg-elevated text-ink-faint";
}

function money(n: number | null): string {
  return n == null ? "—" : `$${n.toLocaleString()}`;
}

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

type Props = {
  agreement: RetainerAgreement;
  tier: RetainerTier | null;
  requests: RetainerRequest[];
  selected: RetainerRequest | null;
  comments: RetainerComment[];
  people: PersonOption[];
  periodStart: string | null;
  periodEnd: string | null;
};

export function RetainerDetail({
  agreement,
  tier,
  requests,
  selected,
  comments,
  people,
  periodStart,
  periodEnd,
}: Props) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<RetainerPriority>("Medium");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [triageName, setTriageName] = useState("");
  const [triageHours, setTriageHours] = useState("1");
  const [triageValue, setTriageValue] = useState("0");
  const [showTriage, setShowTriage] = useState(false);

  const engineers = people.filter((p) => p.isInternal && p.isActive);

  async function submitNew() {
    setError(null);
    const res = await createRetainerRequest({
      retainerId: agreement.id,
      title,
      description,
      priority,
    });
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setShowNew(false);
    // push() alone serves Next's client Router Cache and shows a stale list —
    // refresh() forces the server component to refetch the new request.
    startTransition(() => {
      router.push(`/retainers/${agreement.id}?r=${res.id}`);
      router.refresh();
    });
  }

  async function patch(id: string, p: Parameters<typeof updateRetainerRequest>[1]) {
    setError(null);
    const res = await updateRetainerRequest(id, p);
    if ("error" in res) setError(res.error);
    startTransition(() => router.refresh());
  }

  async function submitTriage() {
    if (!selected) return;
    setError(null);
    const res = await triageRequestToStory({
      requestId: selected.id,
      name: triageName.trim() || selected.title,
      hours: Number(triageHours),
      invoice: Number(triageValue),
    });
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setShowTriage(false);
    setTriageName("");
    setTriageHours("1");
    setTriageValue("0");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      {/* Agreement summary */}
      <section className="bg-surface border border-rule rounded-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <div className="eyebrow mb-1">Tier</div>
            <div className="text-[14px] text-ink-strong">{tier?.name ?? "— none —"}</div>
            {tier?.slaLabel && (
              <div className="text-[10px] text-ink-faint">{tier.slaLabel}</div>
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
              {agreement.subscriptionActive ? "Active" : agreement.dealStatus ?? "—"}
            </span>
          </div>
        </div>
        {!tier && (
          <p className="mt-3 text-[11px] text-amber">
            No tier linked, so no response deadline is calculated. Requests are tracked but
            reported as “Not covered”. Link a tier on the quote to start measuring.
          </p>
        )}
      </section>

      {error && (
        <div className="bg-surface border border-red/30 rounded-card px-4 py-2.5 text-[12px] text-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5">
        {/* Request list */}
        <section className="bg-surface border border-rule rounded-card">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
            <div>
              <div className="eyebrow">Requests</div>
              <div className="text-[12px] text-ink-muted mt-0.5">{requests.length} total</div>
            </div>
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="px-3 py-1.5 text-[12px] rounded-md bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25"
            >
              {showNew ? "Cancel" : "+ New request"}
            </button>
          </div>

          {showNew && (
            <div className="px-4 py-3 border-b border-rule space-y-2 bg-bg-elevated">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What does the client need?"
                className="w-full px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Detail as the client described it…"
                className="w-full px-2.5 py-2 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none resize-y"
              />
              <div className="flex items-center justify-between gap-3">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as RetainerPriority)}
                  className="px-2 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none"
                >
                  {RETAINER_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={submitNew}
                  disabled={pending || title.trim() === ""}
                  className="px-3 py-1.5 text-[12px] rounded-md bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25 disabled:opacity-40"
                >
                  {pending ? "Filing…" : "File request"}
                </button>
              </div>
            </div>
          )}

          {requests.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12px] text-ink-muted">
              No requests yet. File one above to start the SLA clock.
            </div>
          ) : (
            <ul className="divide-y divide-rule/60">
              {requests.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/retainers/${agreement.id}?r=${r.id}`}
                      className={`block px-4 py-2.5 hover:bg-bg-elevated ${
                        active ? "bg-emerald/5 border-l-2 border-emerald" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] text-ink-strong truncate">{r.title}</div>
                        <span className={`${chip} ${priorityTone(r.priority)}`}>
                          {r.priority ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`${chip} bg-bg-elevated text-ink-muted`}>
                          {r.status ?? "—"}
                        </span>
                        <span className={`${chip} ${outcomeTone(r.slaOutcome)}`}>
                          {r.slaOutcome ?? "—"}
                        </span>
                        {r.slaDueAt && !r.firstRespondedAt && (
                          <span className="text-[10px] text-ink-faint font-mono">
                            {/* en-US pinned: SLA deadlines are contractual and
                                must not render as "7 ago" on a Spanish locale. */}
                            due {new Date(r.slaDueAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {r.storyIds.length > 0 && (
                          <span className="text-[10px] text-ink-faint">
                            {r.storyIds.length} stor{r.storyIds.length === 1 ? "y" : "ies"}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Selected request */}
        <section className="bg-surface border border-rule rounded-card">
          {!selected ? (
            <div className="px-4 py-16 text-center text-[12px] text-ink-muted">
              Pick a request to read the thread and respond.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <div className="text-[15px] font-semibold text-ink-strong">{selected.title}</div>
                <div className="text-[11px] text-ink-muted mt-0.5 font-mono">
                  filed {shortDate(selected.submittedAt)}
                  {selected.firstRespondedAt
                    ? ` · answered ${shortDate(selected.firstRespondedAt)}`
                    : " · unanswered"}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selected.status ?? "Submitted"}
                  onChange={(e) => patch(selected.id, { status: e.target.value as RequestStatus })}
                  className="px-2 py-1 text-[11px] bg-bg-elevated border border-rule text-ink rounded-md focus:border-emerald focus:outline-none"
                >
                  {REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={selected.priority ?? "Medium"}
                  onChange={(e) =>
                    patch(selected.id, { priority: e.target.value as RetainerPriority })
                  }
                  className="px-2 py-1 text-[11px] bg-bg-elevated border border-rule text-ink rounded-md focus:border-emerald focus:outline-none"
                >
                  {RETAINER_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={selected.assignedToId ?? ""}
                  onChange={(e) =>
                    patch(selected.id, { assignedToId: e.target.value || null })
                  }
                  className="px-2 py-1 text-[11px] bg-bg-elevated border border-rule text-ink rounded-md focus:border-emerald focus:outline-none max-w-[180px]"
                >
                  <option value="">Unassigned</option>
                  {engineers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className={`${chip} ${outcomeTone(selected.slaOutcome)}`}>
                  {selected.slaOutcome ?? "—"}
                </span>
              </div>

              <RequestThread
                requestId={selected.id}
                comments={comments}
                awaitingFirstResponse={!selected.firstRespondedAt}
              />

              <div className="border-t border-rule pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="eyebrow">
                    Delivery · {selected.storyIds.length} linked stor
                    {selected.storyIds.length === 1 ? "y" : "ies"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTriage((v) => !v)}
                    className="text-[11px] text-ink-muted hover:text-ink-strong underline"
                  >
                    {showTriage ? "Cancel" : "+ Create story"}
                  </button>
                </div>
                {showTriage && (
                  <div className="mt-2 space-y-2 bg-bg-elevated border border-rule rounded-md p-3">
                    <input
                      value={triageName}
                      onChange={(e) => setTriageName(e.target.value)}
                      placeholder={selected.title}
                      className="w-full px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-ink-muted">
                        Hours
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={triageHours}
                          onChange={(e) => setTriageHours(e.target.value)}
                          className="ml-1.5 w-20 px-2 py-1 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none tabnum"
                        />
                      </label>
                      <label className="text-[11px] text-ink-muted">
                        Value $
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={triageValue}
                          onChange={(e) => setTriageValue(e.target.value)}
                          className="ml-1.5 w-24 px-2 py-1 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none tabnum"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={submitTriage}
                        disabled={pending}
                        className="ml-auto px-3 py-1.5 text-[12px] rounded-md bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25 disabled:opacity-40"
                      >
                        {pending ? "Creating…" : "Create story"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
