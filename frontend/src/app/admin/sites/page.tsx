import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { OwnerOnly } from "@/components/admin/OwnerOnly";
import { SitesAdmin } from "@/components/admin/Sites";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.admin.sites.title} · ${ru.admin.title}`,
  robots: { index: false },
};

export default function Page() {
  return (
    <AdminShell>
      <OwnerOnly next="/admin/sites">
        <SitesAdmin />
      </OwnerOnly>
    </AdminShell>
  );
}
