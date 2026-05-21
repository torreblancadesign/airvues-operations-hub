// Grand Central — personal-first daily landing.
// 1) Greeting + status line  2) Firm pulse (hero KPIs)  3) Your day  4) The Board  5) THE STACK.
import { getAppSession } from "@/lib/session";
import { getLandingBoards } from "@/lib/landing";
import { resolvePersonByEmail } from "@/lib/people";
import { getPersonalDay } from "@/lib/personal-landing";
import { getFirmPulse } from "@/lib/firm-pulse";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StationBoard } from "@/components/home/DeparturesBoard";
import { TheStack } from "@/components/home/TheStack";
import { YourDay } from "@/components/home/YourDay";
import { FirmPulse } from "@/components/home/FirmPulse";

async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    return { error: (err as Error).message };
  }
}

function firstName(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0];
  if (!email) return "there";
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default async function HomePage() {
  const session = await getAppSession();
  const sessionName = session?.user?.name;
  const sessionEmail = session?.user?.email;

  const person = await safe(() => resolvePersonByEmail(sessionEmail));
  const personId = person && "id" in person ? person.id : null;
  const personName =
    person && "firstName" in person ? person.firstName : firstName(sessionName, sessionEmail);

  const [day, boards, pulse] = await Promise.all([
    safe(() => getPersonalDay(personId)),
    safe(getLandingBoards),
    safe(getFirmPulse),
  ]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Status line — what's actually on your plate today
  const statusBits: string[] = [];
  if ("todaysEvents" in day) {
    statusBits.push(`${day.todaysEvents.length} meeting${day.todaysEvents.length === 1 ? "" : "s"} today`);
    if (day.active.length > 0)
      statusBits.push(`${day.active.length} stor${day.active.length === 1 ? "y" : "ies"} in flight`);
    if (day.qa.length > 0) statusBits.push(`${day.qa.length} in QA`);
  }
  const statusLine = statusBits.join(" · ") || "Quiet day.";

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      {/* ── Greeting ─────────────────────────────────────────── */}
      <header className="relative mb-8 pb-5 border-b border-rule">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-faint mb-2">
              ◆ Operations control plane
            </div>
            <h1 className="text-[32px] sm:text-[40px] font-semibold text-ink-strong leading-[1.05] tracking-tight">
              Welcome, <span className="text-emerald">{personName}</span>.
            </h1>
            <p className="text-[13px] text-ink-muted mt-2 max-w-2xl">{statusLine}</p>
          </div>
          <div className="text-right text-[12px] text-ink-muted leading-snug shrink-0">
            <div className="font-mono tabnum uppercase tracking-wider">{dateStr}</div>
            <div className="text-[10px] text-ink-faint mt-0.5 font-mono uppercase tracking-wider">
              5-min cache
            </div>
          </div>
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(34, 211, 168, 0.5), transparent 50%)",
          }}
          aria-hidden="true"
        />
      </header>

      {/* ── Firm pulse (HERO) ────────────────────────────────── */}
      <div className="mb-10">
        <SectionTitle
          title="Firm pulse"
          aside={
            <a
              href="/money"
              className="text-[11px] font-mono uppercase tracking-wider text-emerald hover:underline whitespace-nowrap"
            >
              Open Earnings →
            </a>
          }
        />
        {"revenue" in pulse ? (
          <FirmPulse pulse={pulse} />
        ) : (
          <div className="bg-surface border border-red/30 rounded-card p-4 text-[12px] text-red">
            Failed to load firm pulse: {pulse.error}
          </div>
        )}
      </div>

      {/* ── Your day ─────────────────────────────────────────── */}
      <div className="mb-10">
        <SectionTitle title="Your day" aside="Today's agenda + stories in flight" />
        {"todaysEvents" in day ? (
          <YourDay day={day} />
        ) : (
          <div className="bg-surface border border-red/30 rounded-card p-4 text-[12px] text-red">
            Failed to load personal data: {day.error}
          </div>
        )}
      </div>

      {/* ── The Board ────────────────────────────────────────── */}
      {"departures" in boards && (
        <div className="mb-10">
          <SectionTitle title="The board" aside="Team operational state" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <StationBoard
              title="Departures"
              subtitle="Stuck quotes · overdue invoices · sprints ending soon"
              items={boards.departures}
              tone="departure"
              emptyText="Nothing leaving — fully on schedule."
            />
            <StationBoard
              title="Arrivals"
              subtitle="Recent quotes · paid invoices · sprints closed · new stories"
              items={boards.arrivals}
              tone="arrival"
              emptyText="Quiet platform — no recent activity in the last 14 days."
            />
          </div>
        </div>
      )}

      {/* ── The Stack ────────────────────────────────────────── */}
      <div>
        <SectionTitle title="The stack" aside="External tools the team lives in" />
        <TheStack />
      </div>
    </main>
  );
}
