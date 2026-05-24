// Left sidebar nav — operational dashboard rail.
// Routes come from lib/nav.ts (single source of truth); icons are mapped locally.
import Link from "next/link";
import Image from "next/image";
import { signOut } from "@/lib/auth";
import { getAppSession, isDevPreview } from "@/lib/session";
import { isSamlEnabled } from "@/lib/saml";
import { cookies } from "next/headers";
import { SAML_COOKIE_NAME } from "@/lib/samlSession";
import { SidebarNav } from "./SidebarNav";

function IconDollar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5" />
      <path d="M3 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconLeads() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  "/": <IconHome />,
  "/me": <IconUser />,
  "/leads": <IconLeads />,
  "/money": <IconDollar />,
  "/pipeline": <IconChart />,
  "/engineering": <IconCode />,
  "/backlog": <IconList />,
  "/sprints": <IconCalendar />,
  "/clients": <IconBriefcase />,
  "/team": <IconUsers />,
  "/stack": <IconLayers />,
  "/hygiene": <IconShield />,
  "/founder": <IconTarget />,
};

export async function Sidebar() {
  const session = await getAppSession();
  const role = session?.user?.role || "viewer";
  const permissions = session?.user?.permissions ?? [];

  // If the user has a SAML session cookie, sign-out clears that and redirects to login.
  // Otherwise (NextAuth OAuth path) fall back to NextAuth's signOut.
  const samlCookie = (await cookies()).get(SAML_COOKIE_NAME)?.value;
  const samlActive = isSamlEnabled() && !!samlCookie;

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[208px] bg-sidebar border-r border-rule flex-col z-40">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 px-5 pt-5 pb-6 group">
        <Image
          src="/airvues-mark.png"
          alt="Airvues"
          width={28}
          height={30}
          className="shrink-0 group-hover:opacity-90 transition-opacity"
          priority
        />
        <div>
          <div className="text-[15px] font-semibold text-ink-strong leading-none">Airvues</div>
          <div className="text-[10px] text-ink-muted mt-1 leading-none uppercase tracking-wider">Operations</div>
        </div>
      </Link>

      <SidebarNav icons={ICONS} permissions={permissions} role={role} />

      {/* Footer / user */}
      <div className="px-3 pb-3 pt-2 border-t border-rule mt-2 space-y-2">
        <div className="px-2.5 text-[10px] font-mono text-ink-faint tracking-wider uppercase">
          {isDevPreview ? "Dev Preview" : "Live"}
        </div>
        {session?.user?.email && (
          <div className="px-2.5">
            <div className="text-[11px] font-mono text-ink-muted truncate">
              {session.user.email}
            </div>
            <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">
              {role}
            </div>
          </div>
        )}
        {samlActive ? (
          <a
            href="/api/auth/saml/logout"
            className="block px-2.5 text-[11px] text-ink-muted hover:text-ink-strong transition-colors"
          >
            Sign out
          </a>
        ) : (
          <form action={doSignOut} className="px-2.5">
            <button
              type="submit"
              className="text-[11px] text-ink-muted hover:text-ink-strong transition-colors"
            >
              Sign out
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
