import type { Metadata } from "next";

import { CabinetShell } from "@/components/cabinet/CabinetShell";
import { Dashboard } from "@/components/cabinet/Dashboard";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = { title: ru.cabinet.title, robots: { index: false } };

export default function CabinetPage({ searchParams }: PageProps<"/app">) {
  return (
    <CabinetShell>
      <Dashboard searchParams={searchParams as Promise<{ slug?: string }>} />
    </CabinetShell>
  );
}
