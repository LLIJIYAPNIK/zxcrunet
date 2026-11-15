import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { OwnerOnly } from "@/components/admin/OwnerOnly";
import { UsersAdmin } from "@/components/admin/Users";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.admin.users.title} · ${ru.admin.title}`,
  robots: { index: false },
};

export default function Page() {
  return (
    <AdminShell>
      <OwnerOnly next="/admin/users">
        <UsersAdmin />
      </OwnerOnly>
    </AdminShell>
  );
}
