"use client";

import { useRouter } from "next/navigation";
import { ScorecardEngineer } from "@/lib/scorecard-types";

type Props = {
  current: string | null;
  engineers: ScorecardEngineer[];
};

export function PersonPicker({ current, engineers }: Props) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
        Viewing as
      </span>
      <select
        value={current ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/me?as=${v}` : "/me");
        }}
        className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer max-w-[220px]"
      >
        <option value="">— pick a person —</option>
        {engineers
          .filter((e) => !e.isOrphan)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.role ? ` · ${e.role}` : ""}
            </option>
          ))}
      </select>
    </div>
  );
}
