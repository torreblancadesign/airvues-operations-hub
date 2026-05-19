"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

type Props = {
  icons: Record<string, React.ReactNode>;
};

export function SidebarNav({ icons }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3">
      <ul className="space-y-1">
        {NAV_ITEMS.filter((n) => n.showInSidebar).map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`group relative flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] rounded-md transition-all duration-150 ${
                  isActive
                    ? "text-ink-strong bg-emerald/10"
                    : "text-ink-muted hover:text-ink-strong hover:bg-surface/60"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-emerald rounded-full"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`transition-colors ${
                    isActive ? "text-emerald" : "text-ink-faint group-hover:text-ink-muted"
                  }`}
                >
                  {icons[item.href]}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
