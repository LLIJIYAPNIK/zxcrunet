import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { Dashboard } from "@/components/cabinet/Dashboard";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = { title: ru.cabinet.title, robots: { index: false } };

export default function CabinetPage() {
  return (
    <>
      <header className="border-b border-line">
        <div className="wrap flex h-16 items-center sm:h-[72px]">
          <Link href="/" aria-label={ru.auth.toHome}>
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="wrap flex-1 py-10 lg:py-14">
        <Suspense fallback={<p className="text-ink-2">{ru.cabinet.loading}</p>}>
          <Dashboard />
        </Suspense>
      </main>
    </>
  );
}
