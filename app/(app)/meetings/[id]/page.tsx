// /meetings/[id] — meeting detail page.
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { MeetingNotesPanel } from "@/components/meetings/MeetingNotesPanel";
import { RegenerateMeetingButton } from "@/components/meetings/RegenerateMeetingButton";
import { DeleteMeetingButton } from "@/components/meetings/DeleteMeetingButton";
import { LinkLeadEditor } from "@/components/meetings/LinkLeadEditor";
import { getMeetingById } from "@/lib/meetings";
import { listAllLeads } from "@/lib/leads";
import { canMutate } from "@/lib/authz";

export const revalidate = 30;

function fmtDuration(s: number) {
  if (!s) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeetingById(id);
  if (!meeting) notFound();

  const isAdmin = await canMutate();
  const leads = isAdmin
    ? (await listAllLeads().catch(() => []))
        .map((l) => ({
          id: l.id,
          label: `${l.name}${l.company ? ` · ${l.company}` : ""}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title={meeting.title}
        subtitle={`${meeting.ownerName ?? "Unknown"} · ${new Date(meeting.createdAt).toLocaleString()} · ${fmtDuration(meeting.durationSec)}`}
        meta={
          <Link
            href="/meetings"
            className="text-[12px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition"
          >
            ← All meetings
          </Link>
        }
      />

      <div className="space-y-4">
        {meeting.audioUrl && (
          <div className="bg-surface border border-rule rounded-card p-4 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
              Recording
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={meeting.audioUrl} controls className="w-full" />
            <div className="text-[11px] text-ink-faint font-mono flex items-center gap-3">
              <span>{fmtDuration(meeting.durationSec)}</span>
              {meeting.sizeMb != null && <span>{meeting.sizeMb.toFixed(1)} MB</span>}
              <span className="uppercase">{meeting.source}</span>
            </div>
          </div>
        )}

        {isAdmin && (
          <LinkLeadEditor
            meetingId={meeting.id}
            initialLeadId={meeting.linkedLeadId}
            initialLeadName={meeting.linkedLeadName}
            leads={leads}
          />
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">
              Meeting notes
            </div>
            {isAdmin && <RegenerateMeetingButton id={meeting.id} />}
          </div>
          <MeetingNotesPanel
            status={meeting.status}
            summary={meeting.summary}
            keyDecisions={meeting.keyDecisions}
            actionItems={meeting.actionItems}
            questions={meeting.questions}
          />
        </div>

        {meeting.transcript && (
          <details className="bg-surface border border-rule rounded-card p-4 group">
            <summary className="cursor-pointer text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition">
              Full transcript
            </summary>
            <div className="mt-3 text-[12.5px] leading-relaxed text-ink-muted whitespace-pre-wrap font-mono">
              {meeting.transcript}
            </div>
          </details>
        )}

        {isAdmin && (
          <div className="flex justify-end">
            <DeleteMeetingButton id={meeting.id} />
          </div>
        )}
      </div>
    </main>
  );
}
