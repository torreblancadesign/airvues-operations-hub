"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLoop } from "@/lib/mutations/loop";

export function DeleteLoopButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this recording? This cannot be undone.")) return;
        start(async () => {
          const res = await deleteLoop(id);
          if ("error" in res) alert(res.error);
          else {
            router.push("/loops");
            router.refresh();
          }
        });
      }}
      className="px-3 py-1.5 rounded-md border border-red/30 text-red text-[12px] hover:bg-red/10 transition disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
