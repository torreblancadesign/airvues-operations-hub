"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import type { ArchivedKind } from "@/lib/archive";
import { setQuoteArchived } from "@/lib/mutations/quote";
import { setCompanyArchived } from "@/lib/mutations/company";
import { setPersonArchived } from "@/lib/mutations/person";

// Restoring is the safe direction, so it takes one click — the confirmation
// ritual belongs on the way out, not on the way back.
const RESTORE = {
  project: (id: string) => setQuoteArchived(id, false),
  account: (id: string) => setCompanyArchived(id, false),
  person: (id: string) => setPersonArchived(id, false),
} satisfies Record<ArchivedKind, (id: string) => Promise<{ ok: true } | { error: string }>>;

export function RestoreButton({ id, kind }: { id: string; kind: ArchivedKind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-3">
      {error && (
        <p role="alert" className="text-[11px] text-red max-w-[40ch]">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await RESTORE[kind](id);
            if ("error" in res) {
              setError(res.error);
              return;
            }
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-emerald hover:text-emerald disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70"
      >
        <Undo2 aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
        {pending ? "Restoring…" : "Restore"}
      </button>
    </div>
  );
}
