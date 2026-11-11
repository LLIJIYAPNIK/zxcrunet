import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { ru } from "@/i18n/ru";

/** Header + main for cabinet pages; children read the session, so they stream in. */
export function CabinetShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="wrap flex h-16 items-center sm:h-[72px]">
          <Link href="/app" aria-label={ru.cabinet.title}>
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="wrap flex-1 py-10 lg:py-14">
        <Suspense fallback={<p className="text-ink-2">{ru.cabinet.loading}</p>}>
          {children}
        </Suspense>
      </main>
    </>
  );
}
