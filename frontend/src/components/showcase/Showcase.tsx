"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { MadeWith } from "@/components/brand/MadeWith";
import { Wordmark } from "@/components/brand/Wordmark";
import { PalettePicker } from "@/components/theme/PalettePicker";
import { useNeon } from "@/components/theme/NeonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardLink } from "@/components/ui/Card";
import { Badge, Chip } from "@/components/ui/Chip";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Segmented, Tabs } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { SERVICE_DOMAIN } from "@/config/site";
import { ru } from "@/i18n/ru";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="mb-6 font-display text-[28px] leading-tight font-medium tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const t = ru.showcase;
  const s = t.sample;
  const { choice, setChoice } = useNeon();
  const [glow, setGlow] = useState(true);
  const [side, setSide] = useState<"business" | "personal">("business");
  const tabOptions = s.tabs.map((label, i) => ({ value: `t${i}`, label }));
  const [tab, setTab] = useState(tabOptions[0].value);

  return (
    <div className="wrap py-10">
      <header className="flex flex-col gap-3 pb-10">
        <Link href="/" className="w-max">
          <Wordmark />
        </Link>
        <h1 className="mt-6 font-display text-h2 font-medium">{t.title}</h1>
        <p className="text-lead text-ink-2">{t.lead}</p>
      </header>

      <Group title={t.palette}>
        <PalettePicker value={choice} onChange={setChoice} className="max-w-3xl" />
      </Group>

      <Group title={t.buttons}>
        <div className="flex flex-wrap items-center gap-3">
          <Button arrow>{s.primary}</Button>
          <Button variant="secondary">{s.secondary}</Button>
          <Button variant="ghost">{s.ghost}</Button>
          <Button size="sm">{s.small}</Button>
          <Button disabled>{s.disabled}</Button>
        </div>
      </Group>

      <Group title={t.chips}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{s.chip}</Chip>
          <Chip variant="accent">{s.chipAccent}</Chip>
          <Chip variant="fill">{s.chipFill}</Chip>
          <Chip variant="dash">
            <Icon name="plus" size={14} />
            {s.chipDash}
          </Chip>
          <Badge>{s.badge}</Badge>
          <Badge tone="accent">{s.badgeAccent}</Badge>
          <Badge tone="done">{s.badgeDone}</Badge>
        </div>
      </Group>

      <Group title={t.cards}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col gap-2">
            <h3 className="font-display text-h3 font-medium">{s.cardTitle}</h3>
            <p className="text-ink-2">{s.cardText}</p>
            <div className="flex gap-2 pt-4">
              <Chip>Python</Chip>
              <Chip>pytest</Chip>
            </div>
          </Card>
          <CardLink href="#" className="flex flex-col gap-2">
            <h3 className="flex items-center justify-between font-display text-h3 font-medium">
              {s.cardLinkTitle}
              <Icon name="external" className="text-muted" />
            </h3>
            <p className="text-ink-2">{s.cardLinkText}</p>
          </CardLink>
        </div>
      </Group>

      <Group title={t.fields}>
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <Field label={s.fieldName} hint={s.fieldNameHint}>
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} defaultValue={ru.demo.name} />
            )}
          </Field>
          <Field label={s.fieldSlug} error={s.fieldSlugError}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                defaultValue="anna"
                suffix={`.${SERVICE_DOMAIN}`}
              />
            )}
          </Field>
          <div className="md:col-span-2">
            <Field label={s.fieldAbout}>
              {({ id }) => <Textarea id={id} rows={3} className="w-full" />}
            </Field>
          </div>
        </div>
      </Group>

      <Group title={t.controls}>
        <div className="flex max-w-xl flex-col gap-5">
          <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-line bg-surface pr-1 pl-3.5 text-[15px] font-medium">
            {s.glow}
            <Switch checked={glow} onChange={setGlow} label={s.glow} />
          </div>
          <Segmented
            label={s.sideLabel}
            value={side}
            onChange={setSide}
            options={[
              { value: "business", label: s.sideBusiness },
              { value: "personal", label: s.sidePersonal },
            ]}
          />
          <Tabs
            idBase="showcase"
            label={s.tabsLabel}
            value={tab}
            onChange={setTab}
            options={tabOptions}
          />
          <div
            role="tabpanel"
            id={`showcase-panel-${tab}`}
            aria-labelledby={`showcase-tab-${tab}`}
            className="rounded-md border border-dashed border-line-2 p-4 text-muted"
          >
            {s.tabPanel}: {tabOptions.find((o) => o.value === tab)?.label}
          </div>
        </div>
      </Group>

      <Group title={t.avatars}>
        <div className="flex flex-wrap items-end gap-6">
          <Avatar initials="АВ" size={156} glow={glow} />
          <Avatar initials="АВ" size={88} glow={glow} />
          <Avatar initials="АВ" size={52} />
          <Avatar initials="ГР" size={64} muted />
        </div>
      </Group>

      <Group title={t.progress}>
        <div className="flex max-w-xl flex-col gap-5">
          <ProgressBar label={s.progressRead} value={0.41} />
          <ProgressBar label={s.progressSeason} value={0.7} tone="second" />
          <ProgressBar label={s.progressYear} value={0.27} tone="ink" />
        </div>
      </Group>

      <Group title={t.brand}>
        <div className="flex flex-wrap items-center gap-8">
          <Wordmark />
          <MadeWith />
        </div>
      </Group>
    </div>
  );
}
