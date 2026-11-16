import type { Metadata } from "next";

import { SAMPLE_GOTHIC_BLOCKS, SAMPLE_GOTHIC_THEME } from "@/blocks/sample-gothic";
import { PublicSite } from "@/components/public/PublicSite";

export const metadata: Metadata = {
  title: "Пример готической визитки",
  robots: { index: false, follow: false },
};

const blocks = SAMPLE_GOTHIC_BLOCKS as unknown as Record<string, unknown>[];

/** A gothic card: fullscreen hero, collage, running strip, section backgrounds and fonts. */
export default function GothicSamplePage() {
  return (
    <PublicSite
      slug="mira"
      page={{ path: "", title: "Мира Чернова", blocks }}
      content={{
        kind: "business",
        title: "Мира Чернова",
        theme: SAMPLE_GOTHIC_THEME,
        seo: { title: "", description: "" },
        pages: [{ path: "", title: "Мира Чернова", blocks }],
      }}
    />
  );
}
