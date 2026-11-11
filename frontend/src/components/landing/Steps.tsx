import { ru } from "@/i18n/ru";

import { SectionHead } from "./SectionHead";

export function Steps() {
  const t = ru.steps;
  return (
    <section id="steps" aria-labelledby="steps-title" className="wrap scroll-mt-20 py-20 lg:py-28">
      <SectionHead id="steps-title" label={t.label} title={t.title} />
      <ol className="border-t border-line">
        {t.items.map((item, i) => (
          <li
            key={item.title}
            className="grid gap-2 border-b border-line py-6 sm:grid-cols-[48px_minmax(0,4fr)_minmax(0,7fr)] sm:items-baseline sm:gap-6"
          >
            <span className="font-mono text-[13px] text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <b className="font-display text-xl leading-snug font-medium">{item.title}</b>
            <p className="text-ink-2">{item.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
