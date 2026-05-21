"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav";

type Props = {
  icons: Record<string, React.ReactNode>;
};

export function SidebarNav({ icons }: Props) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((n) => n.showInSidebar);

  return (
    <nav className="flex-1 px-3 overflow-y-auto">
      <ul className="space-y-4">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group.id);
          if (groupItems.length === 0) return null;
          return (
            <li key={group.id}>
              <div className="px-2.5 pb-1.5 text-[10px] font-mono text-ink-faint uppercase tracking-wider">
                {group.label}
              </div>
              <ul className="space-y-1">
                {groupItems.map((item) => {
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
