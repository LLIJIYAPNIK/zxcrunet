import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CabinetShell } from "@/components/cabinet/CabinetShell";
import { TitleForm } from "@/components/catalog/TitleForm";
import type { Schemas } from "@/lib/api/client";
import { requireData } from "@/lib/auth/session";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = { title: ru.catalog.editTitle, robots: { index: false } };

type Params = PageProps<"/app/catalog/[id]">["params"];

async function Content({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const catalog = await requireData<Schemas["CatalogOut"]>("/api/catalog", `/app/catalog/${id}`);
  const title = catalog?.titles.find((t) => t.id === id);
  if (!catalog || !title) notFound();
  return <TitleForm key={title.id} catalog={catalog} initial={title} />;
}

export default function TitlePage({ params }: { params: Params }) {
  return (
    <CabinetShell>
      <Content params={params} />
    </CabinetShell>
  );
}
