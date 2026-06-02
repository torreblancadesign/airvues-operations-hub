// Popup recorder page. Opened by the "Join + record" button on a Lead, or by
// "New recording" on /meetings. Pre-binds to a lead via ?leadId=…&source=meet.
import { MeetingRecorder } from "@/components/meetings/MeetingRecorder";
import { listAllLeads } from "@/lib/leads";
import type { MeetingSource } from "@/lib/meetings-types";

function normSource(v: string | string[] | undefined): MeetingSource {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "meet" || s === "zoom" || s === "manual" || s === "other") return s;
  return "manual";
}

export const revalidate = 0;

export default async function RecorderPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; source?: string }>;
}) {
  const sp = await searchParams;
  const leadId = typeof sp.leadId === "string" ? sp.leadId : null;
  const source = normSource(sp.source);

  let leadName: string | null = null;
  let defaultTitle = "Meeting recording";

  if (leadId) {
    try {
      const leads = await listAllLeads();
      const found = leads.find((l) => l.id === leadId);
      if (found) {
        leadName = `${found.name}${found.company ? ` · ${found.company}` : ""}`;
        const today = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        defaultTitle = `${found.name} · ${today}`;
      }
    } catch {
      /* ignore — lead lookup is best-effort for the title */
    }
  } else {
    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    defaultTitle = `Meeting · ${today}`;
  }

  return (
    <main className="max-w-md mx-auto">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-[16px] font-semibold text-ink-strong">Meeting recorder</h1>
        <a
          href="/meetings"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition"
        >
          All meetings ↗
        </a>
      </header>
      <MeetingRecorder
        leadId={leadId}
        leadName={leadName}
        defaultTitle={defaultTitle}
        source={source}
      />
    </main>
  );
}
