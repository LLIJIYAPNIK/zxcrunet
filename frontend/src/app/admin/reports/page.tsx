import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { OwnerOnly } from "@/components/admin/OwnerOnly";
import { ReportsAdmin } from "@/components/admin/Reports";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.admin.reports.title} · ${ru.admin.title}`,
  robots: { index: false },
};

export default function Page() {
  return (
    <AdminShell>
      <OwnerOnly next="/admin/reports">
        <ReportsAdmin />
      </OwnerOnly>
    </AdminShell>
  );
}
