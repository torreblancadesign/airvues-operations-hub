"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMeeting } from "@/lib/mutations/meeting";

export function DeleteMeetingButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this meeting recording? This cannot be undone.")) return;
        start(async () => {
          const res = await deleteMeeting(id);
          if ("error" in res) alert(res.error);
          else {
            router.push("/meetings");
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
