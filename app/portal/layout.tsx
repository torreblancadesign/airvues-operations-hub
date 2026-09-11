import type { Metadata } from "next";
import "./portal.css";
import { getPortalSession } from "@/lib/portal-session";
import { companyNameFor } from "@/lib/portal-data";
import { PortalNav, PortalTopBar, type NavItem } from "@/components/portal/Shell";

export const metadata: Metadata = {
  title: "Your retainer · Airvues",
  description: "Your Airvues retainer: hours, requests, and response times.",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  const company = session ? ((await companyNameFor(session.companyId)) ?? "Your account") : null;

  // Plan carries the commercial terms, so it is an Owner section only.
  const items: NavItem[] = [
    { href: "/portal", label: "Overview" },
    { href: "/portal/requests", label: "Requests" },
    ...(session?.role === "Owner" ? [{ href: "/portal/plan", label: "Plan" }] : []),
  ];

  return (
    <div className="portal-root">
      {/* DIRECTION CONTRACT — impeccable seed 16d8dbd4
        THESIS: The client's retainer stated as an account they can audit — hours bought
        against hours used, promises made against promises kept, and their own team's
        queue in the open. It refuses the agency portal that shows activity instead of
        accountability.
        OWN-WORLD: Cool off-white ground, white panels in three weights, near-black ink,
        one type family on a fixed 9-step scale with tabular figures. Colour is semantic
        ONLY — green met, amber at risk, red breached, blue in progress. No brand accent
        field, no gradients, no dark chrome.
        STORY: The client sees what they bought, what is left, where their request sits
        behind their colleagues', and files the next one without email.
        FIRST VIEWPORT: A rail carrying the client's name and sections; beside it hours
        remaining as one large numeral with its meter and period, then the queue. Primary
        action "New request" sits with the queue it feeds.
        FORM: the category standard (the standing exit), taken by the user over the dealt
        Departure Board; quality bar Mercury / Ramp; seed key 16d8dbd4.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md
      */}

      {session ? (
        <div className="p-shell">
          <PortalNav
            items={items}
            companyName={company ?? "Your account"}
            userName={session.name}
            variant="rail"
          />
          <div className="flex flex-col min-w-0">
            <PortalTopBar companyName={company ?? "Your account"} />
            <main className="p-main flex-1">
              <div className="p-measure">{children}</div>
            </main>
            <PortalNav
              items={items}
              companyName={company ?? "Your account"}
              userName={session.name}
              variant="tabs"
            />
          </div>
        </div>
      ) : (
        <main className="p-main">
          <div className="p-measure">{children}</div>
        </main>
      )}
    </div>
  );
}
