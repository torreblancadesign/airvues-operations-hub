"use client";

import { useRouter } from "next/navigation";
import { DeleteControl } from "@/components/ui/DeleteControl";
import { deleteMeeting } from "@/lib/mutations/meeting";

export function DeleteMeetingButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <DeleteControl
      onConfirm={() => deleteMeeting(id)}
      onDone={() => {
        router.push("/meetings");
        router.refresh();
      }}
      consequence="The meeting leaves the list and its audio file is purged. Transcript and notes stay in Airtable."
    />
  );
}
