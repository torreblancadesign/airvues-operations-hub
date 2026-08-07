"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { updateLoopLinks } from "@/lib/mutations/loop";

type Option = { id: string; label: string };

type Props = {
  loopId: string;
  initialClientId: string | null;
  initialQuoteId: string | null;
  clients: Option[];
  quotes: Option[];
};

function TagSelect({
  label,
  value,
  onChange,
  disabled,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  options: Option[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-md border border-rule bg-bg/50 py-1.5 pl-2.5 pr-7 text-[13px] text-ink-strong transition-colors hover:border-rule-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">— None —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
        />
      </span>
    </label>
  );
}

export function LoopTagsEditor({
  loopId,
  initialClientId,
  initialQuoteId,
  clients,
  quotes,
}: Props) {
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [quoteId, setQuoteId] = useState(initialQuoteId ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    (clientId || null) !== initialClientId || (quoteId || null) !== initialQuoteId;

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateLoopLinks(loopId, {
        linkedClientId: clientId || null,
        linkedQuoteId: quoteId || null,
      });
      if ("error" in res) {
        setMsg({ kind: "err", text: res.error });
      } else {
        setMsg({ kind: "ok", text: "Saved" });
      }
    });
  };

  return (
    <section className="space-y-3 rounded-card border border-rule bg-surface p-4">
      <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">Tags</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TagSelect
          label="Client"
          value={clientId}
          onChange={setClientId}
          disabled={pending}
          options={clients}
        />
        <TagSelect
          label="Quote"
          value={quoteId}
          onChange={setQuoteId}
          disabled={pending}
          options={quotes}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-md border border-emerald/30 bg-emerald/15 px-3 py-1.5 text-[12px] font-medium text-emerald transition-colors hover:bg-emerald/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save tags"}
        </button>
        <p
          aria-live="polite"
          className={`font-mono text-[11px] empty:hidden ${
            msg?.kind === "err" ? "text-red" : "text-emerald"
          }`}
        >
          {msg?.text ?? ""}
        </p>
      </div>
    </section>
  );
}
