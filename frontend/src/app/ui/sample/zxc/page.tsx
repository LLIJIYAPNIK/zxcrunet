import type { Metadata } from "next";

import { SAMPLE_ZXC_BLOCKS, SAMPLE_ZXC_THEME } from "@/blocks/sample-zxc";
import { PublicSite } from "@/components/public/PublicSite";

export const metadata: Metadata = {
  title: "Пример zxc-визитки",
  robots: { index: false, follow: false },
};

const blocks = SAMPLE_ZXC_BLOCKS as unknown as Record<string, unknown>[];
const title = "Тёма · 993";

/** A «zxc» card: sunsets counted down like 1000 − 7, glitch headings, a running strip. */
export default function ZxcSamplePage() {
  return (
    <PublicSite
      slug="dead993"
      page={{ path: "", title, blocks }}
      content={{
        kind: "personal",
        title,
        theme: SAMPLE_ZXC_THEME,
        seo: { title: "", description: "" },
        pages: [{ path: "", title, blocks }],
      }}
    />
  );
}
