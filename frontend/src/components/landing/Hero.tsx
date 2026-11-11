import { ButtonLink } from "@/components/ui/Button";
import { SERVICE_DOMAIN } from "@/config/site";
import { ru } from "@/i18n/ru";

import { VCard } from "./VCard";

export function Hero() {
  const t = ru.hero;
  return (
    <section
      aria-labelledby="hero-title"
      className="wrap grid min-h-[calc(100svh-72px)] grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-16 lg:py-24"
    >
      <div className="flex flex-col gap-6" data-enter>
        <span className="label">{t.label}</span>
        <h1 id="hero-title" className="font-display text-h1 font-medium">
          {t.titleStart} <span className="text-accent">{t.titleAccent}</span>
        </h1>
        <p className="max-w-[34em] text-lead text-ink-2">
          {t.leadStart}{" "}
          <span className="font-mono text-[0.95em] whitespace-nowrap text-ink">
            {t.addressPlaceholder}.{SERVICE_DOMAIN}
          </span>
          . {t.leadEnd}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href="/app/register" arrow>
            {t.primary}
          </ButtonLink>
          <ButtonLink href="#steps" variant="secondary">
            {t.secondary}
          </ButtonLink>
        </div>
      </div>
      <div data-enter>
        <VCard />
      </div>
    </section>
  );
}
