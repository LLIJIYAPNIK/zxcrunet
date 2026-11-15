import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { OwnerOnly } from "@/components/admin/OwnerOnly";
import { ReservedAdmin } from "@/components/admin/Reserved";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.admin.reserved.title} · ${ru.admin.title}`,
  robots: { index: false },
};

export default function Page() {
  return (
    <AdminShell>
      <OwnerOnly next="/admin/reserved">
        <ReservedAdmin />
      </OwnerOnly>
    </AdminShell>
  );
}
