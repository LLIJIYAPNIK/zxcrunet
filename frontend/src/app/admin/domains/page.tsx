import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { OwnerOnly } from "@/components/admin/OwnerOnly";
import { DomainsAdmin } from "@/components/admin/Domains";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.admin.domains.title} · ${ru.admin.title}`,
  robots: { index: false },
};

export default function Page() {
  return (
    <AdminShell>
      <OwnerOnly next="/admin/domains">
        <DomainsAdmin />
      </OwnerOnly>
    </AdminShell>
  );
}
