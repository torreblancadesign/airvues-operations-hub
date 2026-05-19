import { listTeamData } from "@/lib/team";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamDashboard } from "@/components/team/TeamDashboard";

export default async function TeamPage() {
  let data: Awaited<ReturnType<typeof listTeamData>> = { members: [], payments: [] };
  let error: string | null = null;
  try {
    data = await listTeamData();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Team"
        subtitle="Active headcount · payments owed · onboarding · routing problems"
        meta={
          <>
            <div className="font-mono tabnum">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {data.members.length} internal · {data.payments.length} payments · 5-min cache
            </div>
          </>
        }
      />

      {error ? (
        <div className="bg-red-soft border border-red/30 rounded-card p-4 text-[13px] text-red">
          ⚠ Failed to load team data: {error}
        </div>
      ) : (
        <TeamDashboard data={data} />
      )}
    </main>
  );
}
