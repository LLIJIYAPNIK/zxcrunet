import { Claim } from "@/components/landing/Claim";
import { Domains } from "@/components/landing/Domains";
import { Hero } from "@/components/landing/Hero";
import { PaletteSection } from "@/components/landing/PaletteSection";
import { Sides } from "@/components/landing/Sides";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Steps } from "@/components/landing/Steps";
import { NeonProvider } from "@/components/theme/NeonProvider";
import { ru } from "@/i18n/ru";

export default function HomePage() {
  return (
    <NeonProvider className="flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="absolute -top-20 left-4 z-30 rounded-sm bg-accent px-4 py-2.5 font-medium text-accent-ink focus:top-4"
      >
        {ru.nav.skip}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Sides />
        <PaletteSection />
        <Domains />
        <Steps />
        <Claim />
      </main>
      <SiteFooter />
    </NeonProvider>
  );
}
