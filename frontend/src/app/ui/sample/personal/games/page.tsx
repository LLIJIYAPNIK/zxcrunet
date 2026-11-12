import type { Metadata } from "next";

import { SAMPLE_CATALOG } from "@/blocks/sample-personal";
import { PublicSite } from "@/components/public/PublicSite";

import { SAMPLE_PERSONAL_CONTENT as content } from "../content";

export const metadata: Metadata = {
  title: "Пример раздела «Игры»",
  robots: { index: false, follow: false },
};

/** The reference «Раздел · игры»: a shelf with filters, sorting and views. */
export default function GamesSamplePage() {
  return (
    <PublicSite slug="sasha" content={content} page={content.pages[1]} catalog={SAMPLE_CATALOG} />
  );
}
