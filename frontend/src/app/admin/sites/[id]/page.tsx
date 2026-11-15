import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { OwnerOnly } from "@/components/admin/OwnerOnly";
import { SiteCard } from "@/components/admin/Sites";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.admin.sites.title} · ${ru.admin.title}`,
  robots: { index: false },
};

type Params = PageProps<"/admin/sites/[id]">["params"];

async function Card({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return (
    <OwnerOnly next={`/admin/sites/${id}`}>
      <SiteCard siteId={id} />
    </OwnerOnly>
  );
}

export default function Page({ params }: { params: Params }) {
  return (
    <AdminShell>
      <Card params={params} />
    </AdminShell>
  );
}
