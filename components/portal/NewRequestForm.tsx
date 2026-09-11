"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPortalRequest } from "@/lib/mutations/portal-request";
import { RETAINER_PRIORITIES, type RetainerPriority } from "@/lib/retainer-types";

type RetainerChoice = { id: string; label: string };

/** What each priority actually costs the client in wait, so the choice is
 *  informed rather than a guess. null = this plan does not cover it. */
type PromisedHours = Record<RetainerPriority, number | null>;

const GUIDANCE: Record<RetainerPriority, string> = {
  Urgent: "Something is broken or losing you money right now.",
  High: "Blocking work this week.",
  Medium: "Needed soon, not blocking today.",
  Low: "Whenever it fits.",
};

export function NewRequestForm({
  retainers,
  promised,
  showPromises,
}: {
  retainers: RetainerChoice[];
  promised: PromisedHours;
  /** Response windows are an Owner-only commercial term. */
  showPromises: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const locked = busy || pending;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<RetainerPriority>("Medium");
  const [retainerId, setRetainerId] = useState(retainers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (locked) return;
    setError(null);
    setBusy(true);
    try {
      const res = await submitPortalRequest({
        title,
        description,
        priority,
        retainerId: retainerId || undefined,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      startTransition(() => {
        router.push("/portal?filed=1");
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  }

  const window = promised[priority];

  return (
    <div className="p-panel p-6 mt-6">
      {error && (
        <p className="t-body mb-3" style={{ color: "var(--p-bad)" }}>{error}</p>
      )}

      <label className="block">
        <span className="p-label">What do you need?</span>
        <input
          className="p-input mt-1.5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short summary — e.g. Add a booking form to the schedule page"
          maxLength={200}
          autoFocus
        />
      </label>

      <label className="block mt-5">
        <span className="p-label">Any detail that would help</span>
        <textarea
          className="p-input mt-1.5"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Where you saw it, what you expected, anything we should know. Links are fine."
          style={{ resize: "vertical", lineHeight: 1.6 }}
        />
      </label>

      <fieldset className="mt-6">
        <legend className="p-label">How urgent is it?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {RETAINER_PRIORITIES.map((p) => {
            const on = p === priority;
            const hrs = promised[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={on}
                className="text-left transition-colors"
                style={{
                  border: `1px solid ${on ? "var(--p-ink)" : "var(--p-line-strong)"}`,
                  background: on ? "var(--p-sunk)" : "var(--p-panel)",
                  borderRadius: "var(--p-radius-sm)",
                  padding: "11px 13px",
                  boxShadow: on ? "0 0 0 3px rgba(10,15,26,0.06)" : "none",
                }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span style={{ fontSize: "var(--t-base)", fontWeight: 600 }}>{p}</span>
                  {showPromises && (
                    <span className="fig t-fine">
                      {hrs === null ? "not covered" : `${hrs} business hrs`}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    color: "var(--p-ink-2)",
                    marginTop: 2,
                  }}
                >
                  {GUIDANCE[p]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {retainers.length > 1 && (
        <label className="block mt-5">
          <span className="p-label">Which retainer?</span>
          <select
            className="p-input mt-1.5"
            value={retainerId}
            onChange={(e) => setRetainerId(e.target.value)}
          >
            {retainers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div
        className="mt-6 pt-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderTop: "1px solid var(--p-line)" }}
      >
        <p className="t-small" style={{ maxWidth: 400 }}>
          {!showPromises
            ? "This joins your team's queue and we will reply as soon as we can."
            : window === null
              ? "This plan does not set a response time for that priority, so this will be recorded but not timed."
              : `We will reply within ${window} business hours — counted 9am–6pm Pacific, Monday to Friday.`}
        </p>
        <button
          onClick={submit}
          disabled={locked || title.trim().length < 3}
          className="p-btn p-btn-primary"
        >
          {locked ? "Sending…" : "Send request"}
        </button>
      </div>
    </div>
  );
}
