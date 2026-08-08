import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./portal.css";
import { getPortalSession } from "@/lib/portal-session";
import { companyNameFor } from "@/lib/portal-data";

export const metadata: Metadata = {
  title: "Your retainer · Airvues",
  description: "Your Airvues retainer: hours, requests, and response times.",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  const company = session ? await companyNameFor(session.companyId) : null;

  return (
    <div className="portal-root">
      {/* DIRECTION CONTRACT — impeccable seed 16d8dbd4
        THESIS: The client's retainer stated as an account they can audit — hours bought
        against hours used, promises made against promises kept. It refuses the agency
        portal that shows activity instead of accountability.
        OWN-WORLD: Cool off-white ground, white cards, near-black ink, one type family
        (Manrope) with tabular figures. Colour is semantic ONLY — green met, amber at risk,
        red breached, blue in progress. No brand accent field, no gradients, no dark chrome.
        STORY: The client sees what they bought, what is left, and what we owe them right
        now; they file a request without email and trust the number they were shown.
        FIRST VIEWPORT: Airvues mark and client name in a quiet bar; below it hours
        remaining as a large calm numeral with its meter and period, the plan and its four
        response promises alongside, then open requests. Primary action "New request" sits
        top-right of the requests block.
        FORM: the category standard (the standing exit), taken by the user over the dealt
        Departure Board; quality bar Mercury / Ramp; seed key 16d8dbd4.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md
      */}

      <header
        style={{
          background: "var(--p-card)",
          borderBottom: "1px solid var(--p-line)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div className="mx-auto max-w-[980px] px-5 h-[60px] flex items-center justify-between gap-4">
          <Link href="/portal" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/airvues-mark.png"
              alt="Airvues"
              width={26}
              height={26}
              style={{ borderRadius: 6 }}
              priority
            />
            <span className="min-w-0">
              <span
                className="block truncate"
                style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}
              >
                {company ?? "Airvues"}
              </span>
              {company && (
                <span style={{ fontSize: 11.5, color: "var(--p-ink-3)", lineHeight: 1.1 }}>
                  Airvues retainer
                </span>
              )}
            </span>
          </Link>

          {session && (
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="hidden sm:block truncate max-w-[190px]"
                style={{ fontSize: 13.5, color: "var(--p-ink-2)" }}
              >
                {session.name}
              </span>
              <a
                href="/portal/signout"
                style={{ fontSize: 13.5, color: "var(--p-ink-2)" }}
                className="hover:underline"
              >
                Sign out
              </a>
            </div>
          )}
        </div>
      </header>

      {children}

      <footer
        style={{ borderTop: "1px solid var(--p-line)", marginTop: 56 }}
        className="mx-auto max-w-[980px] px-5 py-7"
      >
        <p style={{ fontSize: 12.5, color: "var(--p-ink-3)" }}>
          Airvues LLC · Response times are measured in business hours, 9am–6pm Pacific,
          Monday to Friday.
        </p>
      </footer>
    </div>
  );
}
