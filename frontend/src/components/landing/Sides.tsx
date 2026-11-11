import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ru } from "@/i18n/ru";

import { SectionHead } from "./SectionHead";

type Side = (typeof ru.sides)["business"] | (typeof ru.sides)["personal"];

function SideCard({ side, icon }: { side: Side; icon: IconName }) {
  return (
    <Card lift className="flex flex-col gap-3">
      <Icon name={icon} className="mb-2 text-accent" />
      <h3 className="font-display text-h3 font-medium">{side.title}</h3>
      <p className="text-ink-2">{side.text}</p>
      <ul className="flex flex-wrap gap-2 pt-3">
        {side.blocks.map((block) => (
          <li key={block}>
            <Chip>{block}</Chip>
          </li>
        ))}
      </ul>
      <span className="mt-auto pt-6 font-mono text-[13px] text-accent">{side.address}</span>
    </Card>
  );
}

export function Sides() {
  const t = ru.sides;
  return (
    <section id="sides" aria-labelledby="sides-title" className="wrap scroll-mt-20 py-20 lg:py-28">
      <SectionHead id="sides-title" label={t.label} title={t.title} titleMuted={t.titleMuted} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
        <SideCard side={t.business} icon="briefcase" />
        <SideCard side={t.personal} icon="heart" />
      </div>
    </section>
  );
}
