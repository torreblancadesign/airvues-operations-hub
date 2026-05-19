import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Airvues Ops" },
      { name: "description", content: "Internal operations dashboard for Airvues LLC." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Airvues LLC
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
          Airvues Ops
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Project shell ready. Push the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">airvues-ops</code> repo
          to replace this scaffolding.
        </p>
      </div>
    </main>
  );
}
