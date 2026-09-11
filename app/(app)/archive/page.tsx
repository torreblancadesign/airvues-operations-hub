// /archive — everything soft-deleted, and the way back.
//
// Archived rows are filtered out of every board, picker and filter in the app,
// so without this page a restore would mean opening Airtable. Role-gated to the
// same people who can archive (admin + lead); the restore actions refuse anyone
// else regardless.
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { RestoreButton } from "@/components/archive/RestoreButton";
import { listArchived, type ArchivedKind, type ArchivedRow } from "@/lib/archive";
import { canDelete } from "@/lib/authz";
import { assertCanAccess } from "@/lib/page-guard";

export const dynamic = "force-dynamic";

const SECTIONS: { kind: ArchivedKind; title: string; blurb: string }[] = [
  {
    kind: "project",
    title: "Projects",
    blurb: "Off the Projects board. Stories, invoices and the project log are untouched.",
  },
  {
    kind: "account",
    title: "Accounts",
    blurb: "Off the Accounts board and out of the company pickers. Quotes and revenue still count.",
  },
  {
    kind: "person",
    title: "Team",
    blurb: "Off Team and out of the assignee pickers. Stories and payments are untouched.",
  },
];

export default async function ArchivePage() {
  await assertCanAccess("/archive");
  if (!(await canDelete())) redirect("/");

  let rows: ArchivedRow[] = [];
  let error: string | null = null;
  try {
    rows = await listArchived();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Archive"
        subtitle="Soft-deleted records. Nothing here was destroyed — restore puts it straight back."
        meta={
          <div className="text-[11px] text-ink-faint">
            {rows.length} archived · live read, no cache
          </div>
        }
      />

      {error ? (
        <div className="bg-red-soft border border-red/30 rounded-card p-4 text-[13px] text-red">
          ⚠ Failed to load the archive: {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-rule rounded-card p-8 text-center">
          <p className="text-[13px] text-ink-muted">Nothing is archived.</p>
          <p className="mt-1 text-[12px] text-ink-faint">
            Archiving a project, account or teammate parks it here until someone restores it.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((section) => {
            const items = rows.filter((r) => r.kind === section.kind);
            if (items.length === 0) return null;
            return (
              <section key={section.kind} className="border border-rule rounded-card overflow-hidden">
                <header className="px-4 py-3 bg-bg-elevated border-b border-rule">
                  <h2 className="text-[13px] font-semibold text-ink-strong">
                    {section.title}
                    <span className="ml-2 font-mono text-[11px] text-ink-faint">{items.length}</span>
                  </h2>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{section.blurb}</p>
                </header>
                <ul>
                  {items.map((row) => (
                    <li
                      key={row.id}
                      className="px-4 py-3 border-b border-rule-soft last:border-0 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] text-ink-strong">{row.name}</div>
                        {row.detail && (
                          <div className="text-[11px] text-ink-faint">{row.detail}</div>
                        )}
                        <a
                          href={row.airtableUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-ink-faint hover:text-emerald transition-colors"
                        >
                          Airtable ↗
                        </a>
                      </div>
                      <RestoreButton id={row.id} kind={row.kind} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
