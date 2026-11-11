"use client";

import { PalettePicker } from "@/components/theme/PalettePicker";
import { useNeon } from "@/components/theme/NeonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ru } from "@/i18n/ru";

import { SectionHead } from "./SectionHead";

export function PaletteSection() {
  const { choice, palette, setChoice } = useNeon();
  const t = ru.palette;
  const d = ru.demo;
  const tokens = [
    ["--neon", palette.accent],
    ["--neon-2", palette.second],
    ["--bg", palette.bg],
    ["--surface", palette.surface],
    ["--raised", palette.raised],
    ["--on-neon", palette.accentInk],
  ] as const;

  return (
    <section
      id="palette"
      aria-labelledby="palette-title"
      className="wrap grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-10 py-20 lg:grid-cols-[minmax(0,1fr)_600px] lg:gap-16 lg:py-28"
    >
      <div className="flex flex-col">
        <SectionHead id="palette-title" label={t.label} title={t.title} />
        <p className="-mt-4 mb-8 max-w-[34em] text-lead text-ink-2">{t.text}</p>
        <PalettePicker value={choice} onChange={setChoice} />
        <p className="mt-6 text-sm text-muted">{t.tryIt}</p>
      </div>

      <Card className="flex flex-col gap-6 self-start">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-h3 font-medium">{t.tokensLabel}</h3>
        </div>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          {tokens.map(([name, value]) => (
            <div key={name} className="flex items-center gap-3 border-b border-line py-2.5">
              <span
                aria-hidden="true"
                className="size-6 shrink-0 rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]"
                style={{ background: value }}
              />
              <dt className="flex-1 font-mono text-[13px] text-ink">{name}</dt>
              <dd className="font-mono text-[13px] text-muted">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-5 rounded-md border border-line bg-bg p-5 sm:flex-row sm:items-center">
          <Avatar initials={d.initials} size={72} glow />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <b className="font-display text-lg leading-snug font-medium">{d.name}</b>
            <span className="text-sm text-muted">{d.role}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Chip variant="accent">{d.chips[0]}</Chip>
              <Chip variant="accent">{d.chips[1]}</Chip>
              <Chip className="!border-second !text-second">{d.chips[2]}</Chip>
            </div>
          </div>
          <Button tabIndex={-1} aria-hidden="true">
            {d.write}
          </Button>
        </div>
      </Card>
    </section>
  );
}
