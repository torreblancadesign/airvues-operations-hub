"use client";

// Mobile top bar + slide-in drawer. Visible only below md breakpoint.
// Stateful client component; desktop sidebar is a separate server component.

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { CalendarWidget } from "@/components/header/CalendarWidget";
import { GmailWidget } from "@/components/header/GmailWidget";
import type { CalendarResult } from "@/lib/calendar";
import type { InboxResult } from "@/lib/gmail";

type SignOutHandler = () => Promise<void>;

function I(svg: React.ReactNode) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{svg}</svg>;
}

// Routes from lib/nav.ts; icons mapped here.
const ICONS: Record<string, React.ReactNode> = {
  "/": I(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>),
  "/me": I(<><circle cx="12" cy="8" r="5" /><path d="M3 21v-2a7 7 0 0 1 14 0v2" /></>),
  "/money": I(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>),
  "/pipeline": I(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  "/engineering": I(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>),
  "/backlog": I(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>),
  "/sprints": I(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  "/clients": I(<><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>),
  "/team": I(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  "/stack": I(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
  "/hygiene": I(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>),
};

type Props = {
  userEmail: string | null;
  userRole: string;
  samlActive: boolean;
  signOutAction: SignOutHandler;
};

export function MobileNav({ userEmail, userRole, samlActive, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Top bar — visible on mobile only */}
      <header className="md:hidden sticky top-0 z-40 bg-sidebar border-b border-rule">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/airvues-mark.png" alt="Airvues" width={22} height={24} priority />
            <div>
              <div className="text-[14px] font-semibold text-ink-strong leading-none">Airvues</div>
              <div className="text-[10px] text-ink-muted leading-none mt-0.5 uppercase tracking-wider">Operations</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-surface text-ink-strong"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Drawer + backdrop */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-sidebar border-r border-rule z-50 flex flex-col"
            role="dialog"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-5">
              <div className="flex items-center gap-2.5">
                <Image src="/airvues-mark.png" alt="Airvues" width={28} height={30} />
                <div>
                  <div className="text-[15px] font-semibold text-ink-strong leading-none">Airvues</div>
                  <div className="text-[10px] text-ink-muted mt-1 leading-none uppercase tracking-wider">Operations</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-surface text-ink-muted"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-3 overflow-y-auto">
              <ul className="space-y-0.5">
                {NAV_ITEMS.filter((n) => n.showInSidebar).map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-3 text-[14px] rounded-md transition-colors ${
                          active
                            ? "bg-surface text-ink-strong"
                            : "text-ink-muted hover:text-ink-strong hover:bg-surface/60"
                        }`}
                      >
                        <span className={active ? "text-emerald" : "text-ink-faint"}>{ICONS[item.href]}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="px-3 pb-5 pt-4 border-t border-rule mt-2 space-y-2">
              {userEmail && (
                <div className="px-3">
                  <div className="text-[12px] font-mono text-ink-muted truncate">{userEmail}</div>
                  <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider mt-0.5">{userRole}</div>
                </div>
              )}
              {samlActive ? (
                <a
                  href="/api/auth/saml/logout"
                  className="block px-3 py-2 text-[12px] text-ink-muted hover:text-ink-strong transition-colors"
                >
                  Sign out
                </a>
              ) : (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="block w-full text-left px-3 py-2 text-[12px] text-ink-muted hover:text-ink-strong transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
