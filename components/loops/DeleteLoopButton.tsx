"use client";

import { useRouter } from "next/navigation";
import { DeleteControl } from "@/components/ui/DeleteControl";
import { deleteLoop } from "@/lib/mutations/loop";

export function DeleteLoopButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <DeleteControl
      onConfirm={() => deleteLoop(id)}
      onDone={() => {
        router.push("/loops");
        router.refresh();
      }}
      consequence="The recording and its transcript come off the board and the video file is purged from storage."
    />
  );
}
