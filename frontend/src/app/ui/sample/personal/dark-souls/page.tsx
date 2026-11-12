import type { Metadata } from "next";

import { SAMPLE_CATALOG } from "@/blocks/sample-personal";
import { PublicSite } from "@/components/public/PublicSite";
import { CatalogIndex } from "@/lib/catalog/catalog";

import { SAMPLE_PERSONAL_CONTENT as content } from "../content";

export const metadata: Metadata = {
  title: "Пример страницы серии",
  robots: { index: false, follow: false },
};

/** The reference «Игра · серия Dark Souls», generated from the catalog entry. */
export default function SeriesSamplePage() {
  const title = new CatalogIndex(SAMPLE_CATALOG).find("game", "dark-souls")!;
  return (
    <PublicSite
      slug="sasha"
      content={content}
      page={content.pages[0]}
      catalog={SAMPLE_CATALOG}
      title={title}
    />
  );
}
