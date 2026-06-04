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

      <details className="group bg-surface border border-rule rounded-card mb-4 open:border-emerald/30">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-[13px] text-ink-strong hover:text-emerald transition">
          <span>
            <span className="text-emerald mr-2">?</span>
            How to record a meeting
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-faint group-open:hidden">
            Show
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hidden group-open:inline">
            Hide
          </span>
        </summary>
        <ol className="px-5 pb-4 pt-1 space-y-2 text-[12.5px] text-ink-muted leading-relaxed list-decimal list-inside marker:text-emerald">
          <li>
            Use <strong className="text-ink-strong">Google Chrome</strong> (or another
            Chromium browser like Edge or Arc). Other browsers can&apos;t capture tab audio.
          </li>
          <li>
            <strong className="text-ink-strong">Allow pop-ups</strong> for this site — the
            recorder opens in a small popup window. If Chrome blocks it, click the popup icon
            in the address bar and choose <em>Always allow</em>.
          </li>
          <li>
            Click <span className="font-mono text-emerald">New recording</span> above, or{" "}
            <span className="font-mono text-emerald">Join + record</span> on a Lead with an
            upcoming meeting.
          </li>
          <li>
            When Chrome asks what to share, pick the{" "}
            <strong className="text-ink-strong">browser tab</strong> running your meeting
            (Google Meet, Zoom Web, etc.) — <em>not</em> a window or your whole screen. Then
            tick <strong className="text-ink-strong">&quot;Share tab audio&quot;</strong> at
            the bottom of the dialog.
          </li>
          <li>
            Your microphone is captured separately and mixed in, so the transcript can tell
            who&apos;s talking. Speak normally.
          </li>
          <li>
            Hit <span className="font-mono">■ Stop &amp; review</span> when the meeting ends,
            then <span className="font-mono">Save &amp; transcribe</span>. AI notes appear on
            the meeting page a minute or two later.
          </li>
        </ol>
      </details>

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
