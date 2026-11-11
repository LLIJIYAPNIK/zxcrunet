import type { Metadata } from "next";

import { SAMPLE_BUSINESS_BLOCKS } from "@/blocks/sample";
import { PublicSite } from "@/components/public/PublicSite";

export const metadata: Metadata = {
  title: "Пример бизнес-визитки",
  robots: { index: false, follow: false },
};

const blocks = SAMPLE_BUSINESS_BLOCKS as unknown as Record<string, unknown>[];

/** The reference «Профиль · бизнес» built from real blocks: a visual check of the renders. */
export default function SamplePage() {
  return (
    <PublicSite
      slug="anna"
      page={{ path: "", title: "Анна Волкова", blocks }}
      content={{
        kind: "business",
        title: "Анна Волкова",
        theme: { accent: "#5ab9fc", second: "#ffb545" },
        seo: { title: "", description: "" },
        pages: [{ path: "", title: "Анна Волкова", blocks }],
      }}
    />
  );
}
