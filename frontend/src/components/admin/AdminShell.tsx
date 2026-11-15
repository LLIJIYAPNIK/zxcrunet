import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { Chip } from "@/components/ui/Chip";
import { ru } from "@/i18n/ru";

import { AdminNav, NavTabs } from "./AdminNav";

const t = ru.admin;

/** Header, section tabs and main of the admin panel; pages stream in under Suspense. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="wrap flex h-16 items-center justify-between gap-4 sm:h-[72px]">
          <span className="flex items-center gap-3">
            <Link href="/admin" aria-label={t.title}>
              <Wordmark />
            </Link>
            <Chip variant="accent">{t.title}</Chip>
          </span>
          <Link href="/app" className="text-sm text-ink-2 transition-colors hover:text-ink">
            {t.toCabinet}
          </Link>
        </div>
        <Suspense fallback={<NavTabs pathname="" />}>
          <AdminNav />
        </Suspense>
      </header>
      <main className="wrap flex-1 py-8 lg:py-12">
        <Suspense fallback={<p className="text-ink-2">{t.loading}</p>}>{children}</Suspense>
      </main>
    </>
  );
}
