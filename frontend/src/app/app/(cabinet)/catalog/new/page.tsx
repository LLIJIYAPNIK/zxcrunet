import type { Metadata } from "next";

import { CabinetShell } from "@/components/cabinet/CabinetShell";
import { TitleForm } from "@/components/catalog/TitleForm";
import type { Schemas } from "@/lib/api/client";
import { requireData } from "@/lib/auth/session";
import { TITLE_KINDS, type TitleKind } from "@/lib/catalog/catalog";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = { title: ru.catalog.addTitle, robots: { index: false } };

type Search = PageProps<"/app/catalog/new">["searchParams"];

async function Content({ searchParams }: { searchParams: Search }) {
  const { kind } = await searchParams;
  const catalog = await requireData<Schemas["CatalogOut"]>("/api/catalog", "/app/catalog/new");
  const chosen = TITLE_KINDS.includes(kind as TitleKind) ? (kind as TitleKind) : "game";
  return <TitleForm catalog={catalog ?? { titles: [], posts: [] }} initial={null} kind={chosen} />;
}

export default function NewTitlePage({ searchParams }: { searchParams: Search }) {
  return (
    <CabinetShell>
      <Content searchParams={searchParams} />
    </CabinetShell>
  );
}
