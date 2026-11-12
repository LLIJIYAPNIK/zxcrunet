import type { Metadata } from "next";

import { CabinetShell } from "@/components/cabinet/CabinetShell";
import { CatalogHome } from "@/components/catalog/CatalogHome";
import type { Schemas } from "@/lib/api/client";
import { requireData } from "@/lib/auth/session";
import { TITLE_KINDS, type TitleKind } from "@/lib/catalog/catalog";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = { title: ru.catalog.title, robots: { index: false } };

type Search = PageProps<"/app/catalog">["searchParams"];

async function Content({ searchParams }: { searchParams: Search }) {
  const { kind } = await searchParams;
  const catalog = await requireData<Schemas["CatalogOut"]>("/api/catalog", "/app/catalog");
  const tab =
    kind === "posts" || TITLE_KINDS.includes(kind as TitleKind)
      ? (kind as TitleKind | "posts")
      : "game";
  const data = catalog ?? { titles: [], posts: [], max_titles: 0, max_posts: 0 };
  return (
    <CatalogHome
      catalog={data}
      initialTab={tab}
      limits={{ titles: data.titles.length, maxTitles: data.max_titles }}
    />
  );
}

export default function CatalogPage({ searchParams }: { searchParams: Search }) {
  return (
    <CabinetShell>
      <Content searchParams={searchParams} />
    </CabinetShell>
  );
}
