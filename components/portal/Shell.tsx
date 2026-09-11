"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Desktop rail and mobile tab bar render the SAME items — one nav, two
 *  presentations, so the two viewports can never drift apart. */
export function PortalNav({
  items,
  companyName,
  userName,
  variant,
}: {
  items: NavItem[];
  companyName: string;
  userName: string;
  variant: "rail" | "tabs";
}) {
  const pathname = usePathname();
  const isOn = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  if (variant === "tabs") {
    return (
      <nav className="p-tabbar" aria-label="Sections">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="p-tab"
            aria-current={isOn(it.href) ? "page" : undefined}
          >
            <span className="p-tab-dot" aria-hidden="true" />
            {it.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <aside className="p-rail">
      <Link href="/portal" className="flex items-center gap-2.5 min-w-0 mb-6">
        <Image
          src="/airvues-mark.png"
          alt=""
          width={30}
          height={30}
          style={{ borderRadius: 7, flex: "none" }}
          priority
        />
        <span className="min-w-0">
          <span className="block truncate" style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>
            {companyName}
          </span>
          <span className="block t-fine">Airvues retainer</span>
        </span>
      </Link>

      <nav aria-label="Sections" className="flex flex-col gap-0.5">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="p-navlink"
            aria-current={isOn(it.href) ? "page" : undefined}
          >
            {it.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--p-line)" }}>
        <div className="truncate" style={{ fontSize: "var(--t-sm)", fontWeight: 550 }}>
          {userName}
        </div>
        <a href="/portal/signout" className="t-fine hover:underline">
          Sign out
        </a>
      </div>
    </aside>
  );
}

export function PortalTopBar({ companyName }: { companyName: string }) {
  return (
    <header className="p-topbar">
      <Link href="/portal" className="flex items-center gap-2.5 min-w-0">
        <Image
          src="/airvues-mark.png"
          alt=""
          width={26}
          height={26}
          style={{ borderRadius: 6, flex: "none" }}
          priority
        />
        <span className="truncate" style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>
          {companyName}
        </span>
      </Link>
      <a href="/portal/signout" className="t-small hover:underline shrink-0">
        Sign out
      </a>
    </header>
  );
}
