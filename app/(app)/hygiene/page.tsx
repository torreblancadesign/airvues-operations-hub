// /hygiene — index of all data-quality blockers in one place.
// Links into the dedicated triage UIs where they exist; references Airtable + scripts for the rest.
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { getHygieneIndex } from "@/lib/hygiene";
import { assertCanAccess } from "@/lib/page-guard";

export const revalidate = 60;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type BlockerCardProps = {
  title: string;
  status: "red" | "amber" | "emerald";
  primary: string;
  primaryLabel: string;
  context: string[];
  cta: { label: string; href?: string; external?: boolean };
  description: string;
};

function BlockerCard({ title, status, primary, primaryLabel, context, cta, description }: BlockerCardProps) {
  const tone = status === "red" ? "text-red" : status === "amber" ? "text-amber" : "text-emerald";
  const border = status === "red" ? "border-red/40" : status === "amber" ? "border-amber/40" : "border-emerald/40";
  return (
    <div className={`bg-surface border ${border} rounded-card p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
            Data hygiene
          </div>
          <h3 className="text-[15px] font-semibold text-ink-strong">{title}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-[28px] font-semibold tabnum ${tone} leading-none`}>{primary}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
            {primaryLabel}
          </div>
        </div>
      </div>
      <div className="text-[12px] text-ink-muted mb-3 leading-snug">{description}</div>
      <ul className="text-[11px] font-mono text-ink-muted space-y-0.5 mb-4">
        {context.map((c, i) => <li key={i}>· {c}</li>)}
      </ul>
      {cta.href ? (
        cta.external ? (
          <a
            href={cta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors"
          >
            {cta.label} ↗
          </a>
        ) : (
          <Link
            href={cta.href}
            className="inline-block px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors"
          >
            {cta.label} →
          </Link>
        )
      ) : (
        <div className="text-[11px] font-mono text-ink-faint">{cta.label}</div>
      )}
    </div>
  );
}

export default async function HygienePage() {
  await assertCanAccess("/hygiene");
  let data;
  try {
    data = await getHygieneIndex();
  } catch (err) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader title="Data Hygiene" />
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load hygiene data: {(err as Error).message}
        </div>
      </main>
    );
  }

  const blockerCount =
    (data.orphanStories.count > 0 ? 1 : 0) +
    (data.unroutedPayments.count > 0 ? 1 : 0) +
    (data.emptyTimeEntries.count === 0 ? 1 : 0) +
    (data.staleQuotes.count > 0 ? 1 : 0);

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Data Hygiene"
        subtitle="Single place for everything that should be cleaned up. Most KPIs in this dashboard will lie until these are resolved."
        meta={
          <>
            <div className="font-mono tabnum">
              {blockerCount} active {blockerCount === 1 ? "blocker" : "blockers"}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">5-min cache</div>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Orphan stories"
          tone={data.orphanStories.count > 0 ? "red" : "emerald"}
          value={data.orphanStories.count.toLocaleString()}
          sub={`${fmtMoney(data.orphanStories.invoice)} scope unattributed`}
        />
        <StatCard
          label="Unrouted payments"
          tone={data.unroutedPayments.count > 0 ? "red" : "emerald"}
          value={data.unroutedPayments.count.toLocaleString()}
          sub={`${fmtMoney(data.unroutedPayments.amount)} owed · oldest ${data.unroutedPayments.agingDays}d`}
        />
        <StatCard
          label="Stale quotes (14d+)"
          tone={data.staleQuotes.count > 0 ? "amber" : "emerald"}
          value={data.staleQuotes.count.toLocaleString()}
          sub={`${fmtMoney(data.staleQuotes.value)} stuck in approval/payment`}
        />
        <StatCard
          label="Time Entries"
          tone={data.emptyTimeEntries.count === 0 ? "amber" : "emerald"}
          value={data.emptyTimeEntries.count.toLocaleString()}
          sub={data.emptyTimeEntries.count === 0 ? "Empty — velocity blocked" : "Active logging"}
        />
      </div>

      <SectionTitle title="Blockers" aside="Each one breaks downstream metrics" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BlockerCard
          title="Orphan Stories"
          status={data.orphanStories.count > 0 ? "red" : "emerald"}
          primary={data.orphanStories.count.toLocaleString()}
          primaryLabel="stories"
          context={[
            `${fmtMoney(data.orphanStories.invoice)} scope value unattributed`,
            `${data.orphanStories.hours.toFixed(0)}h scoped work with no engineer`,
            "Engineering board · commission tracker · scorecards all under-report",
          ]}
          cta={
            data.orphanStories.count > 0
              ? { label: "Open triage UI", href: "/hygiene/orphans" }
              : { label: "Resolved" }
          }
          description="Stories with no Assignee. Engineer attribution and commission tracking are blank for these. The triage UI groups them by Quote with engineer suggestions from Quote.Prepared by."
        />

        <BlockerCard
          title="Unrouted Team Payments"
          status={data.unroutedPayments.count > 0 ? "red" : "emerald"}
          primary={fmtMoney(data.unroutedPayments.amount)}
          primaryLabel="owed"
          context={[
            `${data.unroutedPayments.count} payments sitting on support@airvues.com`,
            `Oldest ${data.unroutedPayments.agingDays} days unrouted`,
            "Each one is owed to a real human who hasn't been routed yet",
          ]}
          cta={{
            label: "Open in Airtable",
            href: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_BASE_ID ? "tblvzdxVq7drJtobt" : ""}`,
            external: true,
          }}
          description="Team Task Payments routed to the placeholder collaborator. Auto-inference was too fuzzy to apply safely — needs human pass."
        />

        <BlockerCard
          title="Stale Quotes"
          status={data.staleQuotes.count > 0 ? "amber" : "emerald"}
          primary={fmtMoney(data.staleQuotes.value)}
          primaryLabel="stuck"
          context={[
            `${data.staleQuotes.count} quotes > 14 days in approval / payment`,
            "Either follow up with the client or move to Cancelled / Rejected",
            "Pipeline coverage ratio is inflated until these clear",
          ]}
          cta={{ label: "Open pipeline", href: "/pipeline" }}
          description="Quotes in 'Sent. Awaiting Approval.' or 'Awaiting Payment' for more than 14 days. Either the client is ghosting or the quote needs a nudge."
        />

        <BlockerCard
          title="Time Entries"
          status={data.emptyTimeEntries.count === 0 ? "amber" : "emerald"}
          primary={data.emptyTimeEntries.count.toLocaleString()}
          primaryLabel={data.emptyTimeEntries.count === 0 ? "records — table empty" : "records"}
          context={[
            "Sprint velocity (hours-worked vs scoped) returns zeros",
            "Burndown charts cannot compute",
            "Per-engineer utilization unmeasurable",
          ]}
          cta={{
            label: "Open in Airtable",
            href: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/tblKfmzZ0LtndU0CO`,
            external: true,
          }}
          description="The Time Entries table is empty. Until the team starts logging hours, velocity math (hours worked vs scoped) returns blanks. Build a logging UI when the team is ready to commit to daily entries."
        />
      </div>

      <div className="mt-8 bg-surface border border-rule rounded-card p-5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
          Already cleaned up
        </div>
        <h3 className="text-[14px] font-semibold text-ink-strong mb-2">
          Companies reclassification — 23 of 24
        </h3>
        <p className="text-[12px] text-ink-muted leading-snug mb-3">
          Companies marked "New" with real revenue were reclassified per the rule (Active / Occasional / Iddle / Lost
          based on last-paid date). The "Unknown" placeholder was excluded for manual review ($36K attributed revenue,
          name needs investigation). Rollback log at <code className="text-[11px] font-mono">scripts/output/</code>.
        </p>
        <div className="text-[11px] font-mono text-ink-faint tabnum">
          As of {new Date(data.asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
    </main>
  );
}