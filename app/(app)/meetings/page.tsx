// /meetings — list view.
import { PageHeader } from "@/components/ui/PageHeader";
import { MeetingsBrowser } from "@/components/meetings/MeetingsBrowser";
import { NewRecordingButton } from "@/components/meetings/NewRecordingButton";
import { listAllMeetings } from "@/lib/meetings";

export const revalidate = 60;

export default async function MeetingsPage() {
  let meetings: Awaited<ReturnType<typeof listAllMeetings>> = [];
  let loadError: string | null = null;
  try {
    meetings = await listAllMeetings();
  } catch (e) {
    loadError = (e as Error).message;
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Meetings"
        subtitle="Meeting recordings with AI-generated transcripts, decisions, and action items."
        meta={<NewRecordingButton />}
      />

      {loadError && (
        <div className="bg-surface border border-red/30 rounded-card p-4 text-[13px] text-red mb-4">
          Couldn&apos;t load meetings: {loadError}
          <div className="mt-2 text-ink-muted text-[12px]">
            If this is the first run, make sure the &quot;Meetings&quot; table exists in Airtable
            with the required fields.
          </div>
        </div>
      )}

      {!loadError && meetings.length === 0 && (
        <div className="bg-surface border border-rule rounded-card p-8 text-center">
          <p className="text-[14px] text-ink-muted">No meetings recorded yet.</p>
          <p className="text-[12px] text-ink-faint mt-1">
            Hit <span className="font-mono">New recording</span> above, or click{" "}
            <span className="font-mono">Join + record</span> on a Lead with an upcoming meeting.
          </p>
        </div>
      )}

      {meetings.length > 0 && <MeetingsBrowser meetings={meetings} />}
    </main>
  );
}
