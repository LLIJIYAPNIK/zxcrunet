"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

const t = ru.admin;

const SECTIONS = [
  ["/admin", t.nav.overview],
  ["/admin/reports", t.nav.reports],
  ["/admin/users", t.nav.users],
  ["/admin/sites", t.nav.sites],
  ["/admin/domains", t.nav.domains],
  ["/admin/audit", t.nav.audit],
  ["/admin/plans", t.nav.plans],
  ["/admin/reserved", t.nav.reserved],
] as const;

/** Section tabs with the current one marked (it reads the URL: render inside Suspense). */
export function AdminNav() {
  return <NavTabs pathname={usePathname()} />;
}

/** Section tabs; on a phone they scroll sideways instead of wrapping. */
export function NavTabs({ pathname }: { pathname: string }) {
  return (
    <nav aria-label={t.navLabel} className="wrap -mb-px overflow-x-auto [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1">
        {SECTIONS.map(([href, label]) => {
          const current = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center border-b-2 px-3 text-[15px] font-medium transition-colors",
                  current
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
