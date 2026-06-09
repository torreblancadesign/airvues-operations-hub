"use client";

import { useRef, useState, useTransition } from "react";

type SaveResult = { ok: true } | { error: string };

type BaseProps = {
  label: string;
  hint?: string;
  readOnly?: boolean;
};

type TextProps = BaseProps & {
  kind: "text" | "url";
  value: string | null;
  placeholder?: string;
  onSave: (next: string | null) => Promise<SaveResult>;
};

type NumberProps = BaseProps & {
  kind: "number";
  value: number | null;
  placeholder?: string;
  step?: number;
  suffix?: string;
  onSave: (next: number | null) => Promise<SaveResult>;
};

type SelectProps = BaseProps & {
  kind: "select";
  value: string | null;
  options: string[];
  allowEmpty?: boolean;
  onSave: (next: string | null) => Promise<SaveResult>;
};

type TextareaProps = BaseProps & {
  kind: "textarea";
  value: string;
  placeholder?: string;
  rows?: number;
  onSave: (next: string) => Promise<SaveResult>;
};

type BoolProps = BaseProps & {
  kind: "bool";
  value: boolean;
  onSave: (next: boolean) => Promise<SaveResult>;
};

type Props = TextProps | NumberProps | SelectProps | TextareaProps | BoolProps;

function FieldShell({
  label,
  hint,
  saving,
  error,
  flash,
  children,
}: {
  label: string;
  hint?: string;
  saving: boolean;
  error: string | null;
  flash: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2 border-b border-rule last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-0.5">
          {label}
        </div>
        <div className="text-[9px] text-ink-faint italic">
          {error ? <span className="text-red">{error}</span> : saving ? "saving…" : flash ? "saved" : hint ?? ""}
        </div>
      </div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

export function InlineField(props: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [localValue, setLocalValue] = useState<unknown>(props.value);
  const initialRef = useRef(props.value);

  // Reset local when parent value changes (e.g. after revalidation).
  if (initialRef.current !== props.value && !pending) {
    initialRef.current = props.value;
    if (localValue !== props.value) setLocalValue(props.value);
  }

  function commit(next: unknown, runner: () => Promise<SaveResult>) {
    setLocalValue(next);
    setError(null);
    startTransition(async () => {
      const r = await runner();
      if ("error" in r) {
        setError(r.error);
        setLocalValue(initialRef.current);
      } else {
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      }
    });
  }

  const ro = props.readOnly;

  if (props.kind === "text" || props.kind === "url") {
    const val = (localValue as string | null) ?? "";
    if (ro) {
      return (
        <FieldShell label={props.label} hint={props.hint} saving={false} error={null} flash={false}>
          {val || "—"}
        </FieldShell>
      );
    }
    return (
      <FieldShell label={props.label} hint={props.hint} saving={pending} error={error} flash={flash}>
        <input
          type={props.kind === "url" ? "url" : "text"}
          defaultValue={val}
          key={`${props.label}-${initialRef.current ?? ""}`}
          placeholder={props.placeholder ?? "—"}
          disabled={pending}
          onBlur={(e) => {
            const next = e.target.value.trim() || null;
            if (next === (initialRef.current as string | null)) return;
            commit(next, () => (props.onSave as (v: string | null) => Promise<SaveResult>)(next));
          }}
          className="w-full bg-transparent border-b border-transparent hover:border-rule focus:border-emerald focus:outline-none py-0.5"
        />
      </FieldShell>
    );
  }

  if (props.kind === "number") {
    const val = localValue as number | null;
    if (ro) {
      return (
        <FieldShell label={props.label} hint={props.hint} saving={false} error={null} flash={false}>
          {val != null ? `${val}${props.suffix ?? ""}` : "—"}
        </FieldShell>
      );
    }
    return (
      <FieldShell label={props.label} hint={props.hint} saving={pending} error={error} flash={flash}>
        <input
          type="number"
          step={props.step ?? "any"}
          defaultValue={val ?? ""}
          key={`${props.label}-${initialRef.current ?? ""}`}
          placeholder={props.placeholder ?? "—"}
          disabled={pending}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const next = raw === "" ? null : Number(raw);
            if (next !== null && !Number.isFinite(next)) return;
            if (next === (initialRef.current as number | null)) return;
            commit(next, () => (props.onSave as (v: number | null) => Promise<SaveResult>)(next));
          }}
          className="w-full bg-transparent border-b border-transparent hover:border-rule focus:border-emerald focus:outline-none py-0.5 tabnum font-mono"
        />
      </FieldShell>
    );
  }

  if (props.kind === "select") {
    const val = (localValue as string | null) ?? "";
    if (ro) {
      return (
        <FieldShell label={props.label} hint={props.hint} saving={false} error={null} flash={false}>
          {val || "—"}
        </FieldShell>
      );
    }
    return (
      <FieldShell label={props.label} hint={props.hint} saving={pending} error={error} flash={flash}>
        <select
          value={val}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value || null;
            if (next === (initialRef.current as string | null)) return;
            commit(next, () => (props.onSave as (v: string | null) => Promise<SaveResult>)(next));
          }}
          className="w-full bg-transparent border-b border-transparent hover:border-rule focus:border-emerald focus:outline-none py-0.5 -ml-0.5"
        >
          {(props.allowEmpty ?? true) && <option value="">—</option>}
          {props.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (props.kind === "textarea") {
    const val = (localValue as string) ?? "";
    if (ro) {
      return (
        <FieldShell label={props.label} hint={props.hint} saving={false} error={null} flash={false}>
          {val ? <span className="whitespace-pre-wrap">{val}</span> : "—"}
        </FieldShell>
      );
    }
    return (
      <FieldShell label={props.label} hint={props.hint} saving={pending} error={error} flash={flash}>
        <textarea
          defaultValue={val}
          key={`${props.label}-${(initialRef.current as string) ?? ""}`}
          placeholder={props.placeholder ?? "—"}
          rows={props.rows ?? 3}
          disabled={pending}
          onBlur={(e) => {
            const next = e.target.value;
            if (next === (initialRef.current as string)) return;
            commit(next, () => (props.onSave as (v: string) => Promise<SaveResult>)(next));
          }}
          className="w-full bg-transparent border border-transparent hover:border-rule focus:border-emerald focus:outline-none py-1 px-1 -ml-1 rounded resize-y"
        />
      </FieldShell>
    );
  }

  // bool
  const val = localValue as boolean;
  if (ro) {
    return (
      <FieldShell label={props.label} hint={props.hint} saving={false} error={null} flash={false}>
        {val ? "Yes" : "No"}
      </FieldShell>
    );
  }
  return (
    <FieldShell label={props.label} hint={props.hint} saving={pending} error={error} flash={flash}>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={val}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            commit(next, () => (props.onSave as (v: boolean) => Promise<SaveResult>)(next));
          }}
          className="accent-emerald"
        />
        <span>{val ? "Yes" : "No"}</span>
      </label>
    </FieldShell>
  );
}
