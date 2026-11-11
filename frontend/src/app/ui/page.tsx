import type { Metadata } from "next";

import { Showcase } from "@/components/showcase/Showcase";
import { NeonProvider } from "@/components/theme/NeonProvider";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = {
  title: ru.meta.showcaseTitle,
  robots: { index: false, follow: false },
};

export default function ShowcasePage() {
  return (
    <NeonProvider className="flex-1">
      <Showcase />
    </NeonProvider>
  );
}
