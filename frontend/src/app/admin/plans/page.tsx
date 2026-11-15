import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { OwnerOnly } from "@/components/admin/OwnerOnly";
import { PlansAdmin } from "@/components/admin/Plans";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.admin.plans.title} · ${ru.admin.title}`,
  robots: { index: false },
};

export default function Page() {
  return (
    <AdminShell>
      <OwnerOnly next="/admin/plans">
        <PlansAdmin />
      </OwnerOnly>
    </AdminShell>
  );
}
