"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HoursMeter, PeriodMeter, fmtHours } from "./Meters";
import type { RetainerBoardRow } from "@/lib/retainer-types";

type Health = "breached" | "risk" | "waiting" | "clear";

/** The worst true thing about a retainer right now. Drives dot, tone, wording. */
function healthOf(r: RetainerBoardRow): Health {
  if (r.breachedNowCount > 0) return "breached";
  if (r.atRiskCount > 0) return "risk";
  if (r.unansweredCount > 0) return "waiting";
  return "clear";
}

const DOT: Record<Health, string> = {
  breached: "bg-red",
  risk: "bg-amber",
  waiting: "bg-sky",
  clear: "bg-emerald/40",
};

const TONE: Record<Health, string> = {
  breached: "text-red",
  risk: "text-amber",
  waiting: "text-sky",
  clear: "text-ink-faint",
};

function slaSummary(r: RetainerBoardRow): string {
  if (r.breachedNowCount > 0) return `${r.breachedNowCount} past deadline`;
  if (r.atRiskCount > 0) return `${r.atRiskCount} at risk`;
  if (r.unansweredCount > 0) return `${r.unansweredCount} awaiting reply`;
  if (r.openCount > 0) return `${r.openCount} open, all answered`;
  return "no open requests";
}

export function RetainerBoard({ rows }: { rows: RetainerBoardRow[] }) {
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Read on the client so the period bar never disagrees with the clock.
  // Starts null so the server and first client render match — this value is
  // time-dependent by definition and would otherwise hydrate mismatched.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (attentionOnly && r.breachedNowCount === 0 && r.atRiskCount === 0) return false;
      if (!q) return true;
      return `${r.projectName} ${r.companyName ?? ""} ${r.tierName ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, attentionOnly]);

  // Archived rows are hidden entirely unless asked for. Nothing is deleted —
  // the retainer and everything linked to it stays in the base.
  const visible = filtered.filter((r) => !r.archived);
  const archived = filtered.filter((r) => r.archived);

  // Split on the subscription, not on deal status. A rejected quote and an
  // unsigned proposal both carry Proposal Type "Retainer Agreement", and
  // reporting them as live retainers under an SLA was simply wrong.
  const live = visible.filter((r) => r.subscriptionActive);
  const dormant = visible.filter((r) => !r.subscriptionActive);

  // What the table will actually render. Not `filtered.length` — with every
  // match archived and the toggle off that is non-zero, and the table would
  // render headers over nothing.
  const shownCount = live.length + dormant.length + (showArchived ? archived.length : 0);

  if (rows.length === 0) {
    return (
      <section className="bg-surface border border-rule rounded-card px-6 py-14 text-center">
        <h2 className="text-[15px] font-semibold text-ink-strong">No retainers yet</h2>
        <p className="text-[13px] text-ink-muted mt-2 max-w-md mx-auto leading-relaxed">
          A retainer is a client on a recurring plan with agreed response times. Create one
          with <span className="text-ink">New retainer</span> above, or it appears here on its
          own once a quote is marked “Retainer Agreement” and linked to a company.
        </p>
      </section>
    );
  }

  function liveRow(r: RetainerBoardRow) {
    const health = healthOf(r);
    return (
      <tr key={r.retainerId} className="border-b border-rule/50 hover:bg-bg-elevated transition-colors">
        <td className="px-4 py-3 align-top">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${DOT[health]}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <Link
                href={`/retainers/${r.retainerId}`}
                className="text-[13px] font-medium text-ink-strong hover:text-emerald transition-colors"
              >
                {r.companyName ?? r.projectName}
              </Link>
              <div className="text-[11px] text-ink-faint truncate max-w-[260px] mt-0.5">
                {r.projectName}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {r.tierName ? (
                  <span className="text-[10px] text-ink-muted border border-rule rounded px-1.5 py-0.5">
                    {r.tierName}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber border border-amber/30 rounded px-1.5 py-0.5">
                    no plan · response times not measured
                  </span>
                )}
                {r.slaLabel && (
                  <span className="text-[10px] text-ink-faint truncate max-w-[150px]">
                    {r.slaLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        <td className="px-3 py-3 align-top">
          <div className={`text-[12px] font-medium tabnum ${TONE[health]}`}>{slaSummary(r)}</div>
          {r.oldestUnansweredHours !== null && (
            <div className="text-[10px] text-ink-faint mt-1 tabnum">
              oldest waiting {fmtHours(r.oldestUnansweredHours)}h
            </div>
          )}
          {r.breachedThisPeriodCount > 0 && health !== "breached" && (
            <div className="text-[10px] text-ink-faint mt-0.5 tabnum">
              {r.breachedThisPeriodCount} breached earlier this period
            </div>
          )}
        </td>

        <td className="px-3 py-3 align-top w-[160px]">
          <HoursMeter logged={r.hoursLoggedThisPeriod} included={r.includedHours} />
        </td>

        <td className="px-4 py-3 align-top w-[160px]">
          {now === null ? (
            <div className="h-[38px]" aria-hidden="true" />
          ) : (
            <PeriodMeter start={r.periodStart} end={r.periodEnd} now={now} />
          )}
        </td>
      </tr>
    );
  }

  /** Dormant and archived rows carry no live SLA, so their columns say why. */
  function quietRow(r: RetainerBoardRow, reason: string) {
    return (
      <tr
        key={r.retainerId}
        className="border-b border-rule/50 hover:bg-bg-elevated transition-colors"
      >
        <td className="px-4 py-2.5 align-top">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-rule-strong"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <Link
                href={`/retainers/${r.retainerId}`}
                className="text-[13px] text-ink-muted hover:text-emerald transition-colors"
              >
                {r.companyName ?? r.projectName}
              </Link>
              <div className="text-[11px] text-ink-faint truncate max-w-[260px] mt-0.5">
                {r.projectName}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 align-top text-[11px] text-ink-faint" colSpan={3}>
          {reason}
          {r.openCount > 0 &&
            ` · ${r.openCount} request${r.openCount === 1 ? "" : "s"} kept`}
        </td>
      </tr>
    );
  }

  function groupHeading(title: string, note: string) {
    return (
      <tr>
        <td colSpan={4} className="px-4 pt-7 pb-2">
          <div className="eyebrow text-ink-faint">{title}</div>
          <div className="text-[11px] text-ink-faint mt-1 max-w-xl leading-snug">{note}</div>
        </td>
      </tr>
    );
  }

  return (
    <section className="bg-surface border border-rule rounded-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule flex-wrap">
        <div className="text-[12px] text-ink-muted tabnum">
          {live.length} active · {dormant.length} not active
          {archived.length > 0 && ` · ${archived.length} archived`}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-[11px] text-ink-muted flex items-center gap-1.5 select-none cursor-pointer hover:text-ink transition-colors">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
              className="accent-emerald"
            />
            Needs attention
          </label>
          <label className="text-[11px] text-ink-muted flex items-center gap-1.5 select-none cursor-pointer hover:text-ink transition-colors">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-amber"
            />
            Show archived
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client or plan…"
            className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded-md placeholder:text-ink-faint focus:border-emerald focus:outline-none w-52 transition-colors"
          />
        </div>
      </div>

      {shownCount === 0 ? (
        <div className="px-4 py-12 text-center">
          <div className="text-[13px] text-ink-muted">Nothing matches.</div>
          <div className="text-[11px] text-ink-faint mt-1">
            {attentionOnly && "No retainer is breached or at risk right now. "}
            {!showArchived &&
              archived.length > 0 &&
              `${archived.length} archived retainer${archived.length === 1 ? " is" : "s are"} hidden.`}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-left px-4 py-2.5 eyebrow">Retainer</th>
                <th className="text-left px-3 py-2.5 eyebrow">Response status</th>
                <th className="text-left px-3 py-2.5 eyebrow">Hours this period</th>
                <th className="text-left px-4 py-2.5 eyebrow">Period</th>
              </tr>
            </thead>
            <tbody>
              {live.map(liveRow)}

              {dormant.length > 0 &&
                groupHeading(
                  "Not active",
                  "Cancelled subscriptions, unsigned proposals and rejected quotes. No response times are measured and these are excluded from the counts above.",
                )}
              {dormant.map((r) =>
                quietRow(r, r.dealStatus ? r.dealStatus.toLowerCase() : "subscription not active"),
              )}

              {showArchived &&
                archived.length > 0 &&
                groupHeading(
                  "Archived",
                  "Hidden by default. Nothing was deleted — open one and choose Restore to bring it back.",
                )}
              {showArchived && archived.map((r) => quietRow(r, "archived"))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
