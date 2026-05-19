// /me — personal scorecard for the signed-in engineer.
//
// AUTH NOTE (Phase 0 — 2026-05-17): identity is not yet resolved from the session.
// Until Google OAuth + email→People mapping ships (see docs/auth-architecture-2026-05-17.md),
// this page accepts ?as=<personId> to pick which engineer's scorecard to view.
// Defaults to picker mode if no param is given.
import { getScorecard } from "@/lib/scorecard";
import { PersonScorecard } from "@/components/me/PersonScorecard";
import { PersonPicker } from "@/components/me/PersonPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { canMutate } from "@/lib/authz";

export const revalidate = 300;

type SearchParams = { as?: string };

export default async function MePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const engineerId = sp.as ?? null;
  const editable = await canMutate();

  let payload;
  try {
    payload = await getScorecard(engineerId);
  } catch (err) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader title="Personal Scorecard" />
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load scorecard: {(err as Error).message}
        </div>
      </main>
    );
  }

  // No engineer selected — show picker prompt with explanation FIRST.
  if (!payload.scorecard) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader
          title="Personal Scorecard"
          subtitle="Open-access mode until Google sign-in resolves identity automatically."
        />
        <div className="bg-amber/5 border border-amber/30 rounded-card p-5 mb-4 max-w-2xl">
          <div className="text-[12px] font-semibold text-amber mb-1">
            Why am I picking a person?
          </div>
          <div className="text-[12px] text-ink-muted leading-snug">
            Right now the dashboard uses a shared admin password — there's no
            individual identity yet. Once Google OAuth flips (see{" "}
            <code className="font-mono text-ink-strong">docs/auth-runbook-google-oauth.md</code>),
            this page auto-resolves to your engineer record via your signed-in email.
            For now, pick whose scorecard you want to view.
          </div>
        </div>
        <div className="bg-surface border border-rule rounded-card p-6 max-w-md">
          <PersonPicker current={null} engineers={payload.engineers} />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PersonScorecard
        scorecard={payload.scorecard}
        engineers={payload.engineers}
        canEdit={editable}
      />
    </main>
  );
}
