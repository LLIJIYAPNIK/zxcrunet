import { Wordmark } from "@/components/brand/Wordmark";
import { SERVICE_DOMAIN } from "@/config/site";
import { ru } from "@/i18n/ru";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-16 px-4 py-10 sm:px-8">
      <header>
        <Wordmark />
      </header>
      <section className="flex flex-col gap-6">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">
          {ru.home.tagline}
        </h1>
        <p className="max-w-xl text-lg text-ink/70">
          {ru.home.lead}{" "}
          <span className="font-mono text-accent">
            {ru.home.addressPlaceholder}.{SERVICE_DOMAIN}
          </span>
        </p>
        <p className="font-mono text-sm tracking-widest text-ink/50 uppercase">{ru.home.soon}</p>
      </section>
    </main>
  );
}
