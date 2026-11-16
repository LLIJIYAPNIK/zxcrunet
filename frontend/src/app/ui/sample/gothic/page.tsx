import type { Metadata } from "next";

import { SAMPLE_GOTHIC_BLOCKS, SAMPLE_GOTHIC_THEME } from "@/blocks/sample-gothic";
import { PublicSite } from "@/components/public/PublicSite";

export const metadata: Metadata = {
  title: "Пример готической визитки",
  robots: { index: false, follow: false },
};

const blocks = SAMPLE_GOTHIC_BLOCKS as unknown as Record<string, unknown>[];

/** The business sample in the gothic style: a visual check of styles, fonts and sections. */
export default function GothicSamplePage() {
  return (
    <PublicSite
      slug="anna"
      page={{ path: "", title: "Анна Волкова", blocks }}
      content={{
        kind: "business",
        title: "Анна Волкова",
        theme: SAMPLE_GOTHIC_THEME,
        seo: { title: "", description: "" },
        pages: [{ path: "", title: "Анна Волкова", blocks }],
      }}
    />
  );
}
