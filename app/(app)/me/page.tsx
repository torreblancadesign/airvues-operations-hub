// /me — personal scorecard for the signed-in engineer.
//
// Permission model:
//   - With `Scorecard - Admin` permission (or admin role): can view anyone via
//     `?as=<personId>` and the picker is shown.
//   - Without it: locked to the signed-in user's own scorecard (resolved via
//     People.Primary Email). No picker, no `?as=` override.
import { getScorecard } from "@/lib/scorecard";
import { PersonScorecard } from "@/components/me/PersonScorecard";
import { PersonPicker } from "@/components/me/PersonPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { canMutate } from "@/lib/authz";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";
import { canSwitchScorecard } from "@/lib/permissions";

export const revalidate = 300;

type SearchParams = { as?: string };

export default async function MePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await getAppSession();
  const editable = await canMutate();

  const canSwitch = canSwitchScorecard(
    session?.user?.permissions,
    session?.user?.role,
  );

  // Resolve current user's person id from their session email.
  let ownPersonId: string | null = null;
  try {
    const person = await resolvePersonByEmail(session?.user?.email);
    ownPersonId = person?.id ?? null;
  } catch {
    ownPersonId = null;
  }

  // Pick which engineer to load. Non-admins are pinned to themselves.
  const engineerId = canSwitch ? (sp.as ?? ownPersonId) : ownPersonId;

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

  // No scorecard available.
  if (!payload.scorecard) {
    // Non-admin without a matching People record — friendly message.
    if (!canSwitch) {
      return (
        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <PageHeader title="Personal Scorecard" />
          <div className="bg-surface border border-rule rounded-card p-6 max-w-2xl text-[13px] text-ink-muted leading-snug">
            We couldn&apos;t find an engineer record matching your email
            {session?.user?.email ? ` (${session.user.email})` : ""}. Ask an
            admin to link your People record so your scorecard can load.
          </div>
        </main>
      );
    }

    // Admin / scorecard-admin view — show the picker.
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader
          title="Personal Scorecard"
          subtitle="Pick whose scorecard you want to view."
        />
        <div className="bg-surface border border-rule rounded-card p-6 max-w-md">
          <PersonPicker current={null} engineers={payload.engineers} />
        </div>
      </main>
    );
  }

  const canEditGoal = editable || (!!ownPersonId && engineerId === ownPersonId);

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PersonScorecard
        scorecard={payload.scorecard}
        engineers={payload.engineers}
        canEdit={editable}
        canSwitchPerson={canSwitch}
        canEditGoal={canEditGoal}
      />
    </main>
  );
}
