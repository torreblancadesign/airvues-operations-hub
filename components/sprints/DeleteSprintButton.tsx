"use client";

import { useRouter } from "next/navigation";
import { DeleteControl } from "@/components/ui/DeleteControl";
import { useCanDelete } from "@/components/DeletePermission";
import { deleteSprint } from "@/lib/mutations/sprint";

/** Hides itself unless the viewer is admin/lead — the action refuses anyone else anyway. */
export function DeleteSprintButton({
  sprintId,
  label,
  storyCount,
}: {
  sprintId: string;
  label: string;
  storyCount: number;
}) {
  const router = useRouter();
  const canDelete = useCanDelete();
  if (!canDelete) return null;

  return (
    <DeleteControl
      label="Delete sprint"
      question={`Delete ${label}?`}
      consequence={
        storyCount > 0
          ? `${storyCount} ${storyCount === 1 ? "story goes" : "stories go"} back to the backlog — no story is deleted. Capacity rows for this sprint are removed.`
          : "Capacity rows for this sprint are removed. No stories are attached."
      }
      onConfirm={() => deleteSprint(sprintId)}
      onDone={() => {
        router.push("/sprints");
        router.refresh();
      }}
    />
  );
}
