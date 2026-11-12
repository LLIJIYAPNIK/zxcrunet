import type { Metadata } from "next";

import { SAMPLE_CATALOG } from "@/blocks/sample-personal";
import { PublicSite } from "@/components/public/PublicSite";

import { SAMPLE_PERSONAL_CONTENT as content } from "./content";

export const metadata: Metadata = {
  title: "Пример личной визитки",
  robots: { index: false, follow: false },
};

/** The reference «Профиль · личное» built from real blocks and a sample catalog. */
export default function PersonalSamplePage() {
  return (
    <PublicSite slug="sasha" content={content} page={content.pages[0]} catalog={SAMPLE_CATALOG} />
  );
}
