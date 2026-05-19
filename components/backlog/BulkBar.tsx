"use client";

import { useState, useTransition } from "react";
import { bulkUpdateStories, type StoryPatch } from "@/lib/mutations/story";

type EngineerOption = { id: string; name: string };

type Props = {
  selectedIds: string[];
  engineers: EngineerOption[];
  onClear: () => void;
  onSuccess: () => void;
};

const STATUS_OPTIONS = ["Todo", "In progress", "QA Review", "Completed", "On Hold"];
const PRIORITY_OPTIONS = ["Urgent", "High", "Medium", "Low"];

const selectCls =
  "px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer";

export function BulkBar({ selectedIds, engineers, onClear, onSuccess }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function runBulk(patch: StoryPatch, label: string) {
    setError(null);
    startTransition(async () => {
      const res = await bulkUpdateStories(selectedIds, patch);
      if (!("ok" in res)) {
        setError(`${label}: ${res.error}`);
      } else {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
        onSuccess();
      }
    });
  }

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 mb-3 bg-emerald/10 border-y border-emerald/30 backdrop-blur px-4 sm:px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-[12px] text-emerald font-mono font-semibold tabnum">
          <span>{selectedIds.length}</span>
          <span className="text-ink-muted font-normal">selected</span>
          {pending && <span className="text-amber">· saving…</span>}
          {savedFlash && !pending && <span className="text-emerald">· saved</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          <select
            disabled={pending}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                runBulk({ assigneeIds: [e.target.value] }, "Assign");
                e.currentTarget.value = "";
              }
            }}
            className={selectCls}
            aria-label="Bulk assign"
          >
            <option value="">Assign to…</option>
            {engineers.map((eng) => (
              <option key={eng.id} value={eng.id}>{eng.name}</option>
            ))}
          </select>

          <select
            disabled={pending}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                runBulk({ status: e.target.value }, "Status");
                e.currentTarget.value = "";
              }
            }}
            className={selectCls}
            aria-label="Bulk status"
          >
            <option value="">Set status…</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            disabled={pending}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                runBulk({ priority: e.target.value }, "Priority");
                e.currentTarget.value = "";
              }
            }}
            className={selectCls}
            aria-label="Bulk priority"
          >
            <option value="">Set priority…</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-1.5 text-[11px] text-red font-mono">{error}</div>
      )}
    </div>
  );
}
