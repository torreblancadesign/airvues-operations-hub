// Authenticated app shell — Sidebar (desktop) + MobileNav (mobile) + TopBar + main content area.
import { getAppSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { TopBar } from "@/components/header/TopBar";
import { CommandPaletteProvider } from "@/components/search/CommandPaletteProvider";
import { signOut } from "@/lib/auth";
import { isSamlEnabled } from "@/lib/saml";
import { SAML_COOKIE_NAME } from "@/lib/samlSession";
import { getUpcomingEvents } from "@/lib/calendar";
import { getRecentInbox } from "@/lib/gmail";
import { getWeatherSnapshot } from "@/lib/weather";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session?.user?.role) {
    redirect("/login");
  }

  const samlCookie = (await cookies()).get(SAML_COOKIE_NAME)?.value;
  const samlActive = isSamlEnabled() && !!samlCookie;

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const [calendarResult, inboxResult, weather] = await Promise.all([
    getUpcomingEvents().catch(
      (err) => ({ kind: "error" as const, message: (err as Error).message }),
    ),
    getRecentInbox().catch(
      (err) => ({ kind: "error" as const, message: (err as Error).message }),
    ),
    getWeatherSnapshot().catch(() => ({
      city: null,
      region: null,
      country: null,
      timezone: null,
      temperatureF: null,
      conditionLabel: null,
      conditionEmoji: null,
      isFallback: true,
    })),
  ]);

  return (
    <CommandPaletteProvider>
      <Sidebar />
      <MobileNav
        userEmail={session.user.email}
        userRole={session.user.role}
        samlActive={samlActive}
        signOutAction={doSignOut}
        calendarResult={calendarResult}
        inboxResult={inboxResult}
        weather={weather}
        permissions={session.user.permissions}
      />
      <div className="md:ml-[208px] min-h-screen page-enter">
        <TopBar />
        {children}
      </div>
    </CommandPaletteProvider>
  );
}
