/**
 * Block renders: pure components (no hooks), used by the public site (server) and by the
 * editor preview (client). Layout follows the nearest `@container`, not the viewport.
 */
import Image from "next/image";
import type { ReactNode } from "react";

import { LoopVideo } from "@/components/public/LoopVideo";
import { ProfileCard } from "@/components/public/ProfileCard";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ru } from "@/i18n/ru";
import { cn } from "@/lib/cn";

import { SectionFrame } from "./appearance";
import { COLLAGE_RENDERERS } from "./collage";
import { MEDIA_RENDERERS } from "./media";
import { PERSONAL_RENDERERS } from "./personal";
import { anchorId, isVideo, type AnyBlock, type ContactKind, type SettingsOf } from "./schemas";
import {
  CWRAP,
  SectionHead,
  SmartLink,
  accentLink,
  externalProps,
  type BlockProps as Props,
  type RenderContext,
} from "./ui";

export { CWRAP, type RenderContext };

function HeroText({ s, center = false }: { s: SettingsOf<"hero">; center?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-6", center && "items-center text-center")} data-enter>
      {s.label && <span className="label">{s.label}</span>}
      <h1 className="font-display text-ch1 font-medium">{s.title}</h1>
      {s.lead && <p className="max-w-[32em] text-clead whitespace-pre-line text-ink-2">{s.lead}</p>}
      {(s.primary || s.secondary) && (
        <div className={cn("flex flex-wrap gap-3 pt-1", center && "justify-center")}>
          {s.primary && (
            <ButtonLink href={s.primary.url} arrow>
              {s.primary.label}
            </ButtonLink>
          )}
          {s.secondary && (
            <ButtonLink href={s.secondary.url} variant="secondary">
              {s.secondary.label}
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Scrapbook layouts for 1–6 pictures on a 6×6 board: [x, y, w, h, tilt°].
 * Pieces overlap a little and lean, later ones on top.
 */
const BOARDS: Record<number, [number, number, number, number, number][]> = {
  1: [[0, 0, 6, 6, 0]],
  2: [
    [0, 0, 4, 5, -2],
    [3, 2, 3, 4, 3],
  ],
  3: [
    [0, 0, 4, 4, -2],
    [4, 0, 2, 3, 2],
    [2, 3, 4, 3, -1],
  ],
  4: [
    [0, 0, 3, 4, -2],
    [3, 0, 3, 3, 2],
    [0, 4, 2, 2, 1],
    [2, 3, 4, 3, -1],
  ],
  5: [
    [0, 0, 3, 3, -2],
    [3, 0, 3, 4, 2],
    [0, 3, 2, 3, 1],
    [2, 3, 2, 3, -3],
    [4, 4, 2, 2, 2],
  ],
  6: [
    [0, 0, 2, 3, -2],
    [2, 0, 4, 3, 1],
    [0, 3, 3, 3, 2],
    [3, 3, 3, 2, -1],
    [3, 5, 2, 1, 0],
    [5, 5, 1, 1, 3],
  ],
};

function HeroCollage({ media }: { media: SettingsOf<"hero">["media"] }) {
  const board = BOARDS[media.length] ?? [];
  return (
    <div
      data-hero-collage=""
      className="grid aspect-square w-full grid-cols-6 grid-rows-6 gap-2 @5xl:gap-3"
    >
      {media.map((item, i) => {
        const [x, y, w, h, tilt] = board[i];
        return (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-md border border-line-2 bg-raised shadow-[0_18px_40px_-18px_rgba(0,0,0,.7)]"
            style={{
              gridColumn: `${x + 1} / span ${w}`,
              gridRow: `${y + 1} / span ${h}`,
              transform: tilt ? `rotate(${tilt}deg)` : undefined,
              zIndex: i + 1,
            }}
          >
            {isVideo(item) ? (
              <LoopVideo src={item.url} className="absolute inset-0 size-full" />
            ) : (
              <Image
                src={item.url}
                alt=""
                fill
                unoptimized
                sizes="(min-width: 1024px) 300px, 50vw"
                className="object-cover"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Hero({ id, settings: s, ctx }: Props<"hero">) {
  const name = s.card_name || ctx.siteTitle;

  if (s.layout === "fullscreen") {
    const center = s.align === "center";
    const shade = `rgba(0, 0, 0, ${s.dim / 100})`;
    const background = s.background;
    return (
      <header
        id={id}
        data-hero="fullscreen"
        className="relative isolate flex min-h-[min(100svh,60rem)] items-center overflow-hidden py-20"
      >
        {background && (
          <span aria-hidden="true" className="absolute inset-0 -z-10">
            {isVideo(background) ? (
              <LoopVideo src={background.url} className="absolute inset-0 size-full" />
            ) : (
              <Image
                src={background.url}
                alt=""
                fill
                unoptimized
                priority
                sizes="100vw"
                className="object-cover"
              />
            )}
            <span
              className="absolute inset-0"
              style={{ background: `linear-gradient(${shade}, ${shade})` }}
            />
          </span>
        )}
        <div className={cn(CWRAP, center ? "flex justify-center" : "")}>
          <div className={cn(center ? "max-w-[52rem]" : "max-w-[44rem]")}>
            <HeroText s={s} center={center} />
          </div>
        </div>
      </header>
    );
  }

  const side =
    s.layout === "collage" ? (
      s.media.length ? (
        <HeroCollage media={s.media} />
      ) : null
    ) : name ? (
      <ProfileCard
        name={name}
        role={s.card_role}
        address={ctx.address}
        chips={s.chips}
        avatarUrl={s.avatar?.url}
        pattern={s.pattern}
      />
    ) : null;

  return (
    <header
      id={id}
      data-hero={s.layout}
      className={cn(
        CWRAP,
        "grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 @5xl:grid-cols-[minmax(0,1fr)_520px] @5xl:gap-16 @5xl:py-24",
      )}
    >
      <HeroText s={s} />
      {side}
    </header>
  );
}

/** Desktop columns per fact count: rows stay balanced (6 → 3 + 3, 9 → 3 × 3). */
const FACT_COLUMNS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 3,
  7: 4,
  8: 4,
  9: 3,
  10: 5,
};
const GRID_COLS: Record<number, string> = {
  1: "@4xl:grid-cols-1",
  2: "@4xl:grid-cols-2",
  3: "@4xl:grid-cols-3",
  4: "@4xl:grid-cols-4",
  5: "@4xl:grid-cols-5",
};

function Facts({ id, settings: s }: Props<"facts">) {
  const n = s.items.length;
  const cols = FACT_COLUMNS[n] ?? 4;
  return (
    <section id={id} aria-label="Факты" className={CWRAP}>
      {/* Cells draw their top and left lines; the outer ones hide under the wrapper. */}
      <div className="overflow-hidden border-y border-line">
        <div className={cn("-mt-px grid", n > 1 ? "grid-cols-2" : "grid-cols-1", GRID_COLS[cols])}>
          {s.items.map((item, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-3 border-t border-line py-6 pr-4 @4xl:py-8 @4xl:pr-6",
                i % 2 ? "border-l pl-4" : "pl-0",
                i % cols ? "@4xl:border-l @4xl:pl-6" : "@4xl:border-l-0 @4xl:pl-0",
                n % 2 === 1 && i === n - 1 && "@max-4xl:col-span-2",
              )}
            >
              <span className="font-display text-cstat font-medium">{item.value}</span>
              <span className="max-w-[16em] text-ink-2">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Experience({ id, settings: s }: Props<"experience">) {
  const last = s.items.length - 1;
  return (
    <section id={id} className={cn(CWRAP, "scroll-mt-20 pt-20 pb-14 @3xl:pt-24 @3xl:pb-18")}>
      <SectionHead label={s.label} title={s.title} />
      <ol>
        {s.items.map((item, i) => (
          <li
            key={i}
            className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0 @3xl:gap-x-8"
          >
            {i < last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-12 bottom-2 left-5 w-px -translate-x-1/2",
                  item.current ? "bg-linear-to-b from-accent to-line-2" : "bg-line-2",
                )}
              />
            )}
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full border font-mono text-[13px]",
                item.current
                  ? "border-accent bg-accent text-accent-ink shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_16%,transparent),0_0_28px_var(--glow)]"
                  : "border-line-2 bg-surface text-ink-2",
              )}
            >
              {i + 1}
            </span>
            <div className="grid gap-2 pt-1.5 @3xl:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] @3xl:gap-6">
              <div className="flex flex-col items-start gap-1.5">
                <b className="font-display text-xl leading-snug font-medium">{item.title}</b>
                {item.current && (
                  <span className="label text-accent">{ru.builder.fields.current}</span>
                )}
              </div>
              {item.text && (
                <p className="whitespace-pre-line text-ink-2 @3xl:pt-0.5">{item.text}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Projects({ id, settings: s }: Props<"projects">) {
  return (
    <section id={id} className={cn(CWRAP, "scroll-mt-20 pt-6 pb-14 @3xl:pb-18")}>
      <SectionHead
        label={s.label}
        title={s.title}
        aside={s.all_link ? <SmartLink link={s.all_link} className={accentLink} /> : undefined}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @3xl:grid-cols-2 @5xl:grid-cols-3">
        {s.items.map((p, i) => {
          const body = (
            <>
              {p.label && <span className="label">{p.label}</span>}
              <h3 className="font-display text-h3 font-medium">{p.title}</h3>
              {p.text && <p className="whitespace-pre-line text-ink-2">{p.text}</p>}
              {p.tags.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {p.tags.map((tag, t) => (
                    <Chip key={`${tag}-${t}`}>{tag}</Chip>
                  ))}
                </div>
              )}
              {p.link && (
                <span
                  className={cn(
                    "flex items-center gap-2.5 border-t border-line pt-5 font-medium",
                    !p.tags.length && "mt-auto",
                  )}
                >
                  <Icon name={/github\.com/i.test(p.link.url) ? "github" : "external"} size={20} />
                  {p.link.label}
                </span>
              )}
            </>
          );
          const card =
            "flex flex-col gap-4 rounded-lg @3xl:min-h-[300px] border border-line bg-surface p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] @lg:p-8";
          return p.link ? (
            <a
              key={i}
              href={p.link.url}
              {...externalProps(p.link.url)}
              className={cn(
                card,
                "transition-[transform,border-color,box-shadow] duration-200 ease-neon hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_12px_32px_rgba(0,0,0,.35)]",
              )}
            >
              {body}
            </a>
          ) : (
            <div key={i} className={card}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Interests({ id, settings: s }: Props<"interests">) {
  return (
    <section id={id} aria-label={s.label || "Интересы"} className={CWRAP}>
      <div className="flex flex-col gap-4 border-y border-line py-8 @3xl:flex-row @3xl:items-center @3xl:gap-6 @3xl:py-10">
        {s.label && <span className="label shrink-0 @3xl:w-[120px]">{s.label}</span>}
        <div className="flex flex-wrap gap-2">
          {s.items.map((item, i) => (
            <Chip key={`${item}-${i}`} className="h-10 px-[18px] text-[15px]">
              {item}
            </Chip>
          ))}
        </div>
      </div>
    </section>
  );
}

function StackBlock({ id, settings: s }: Props<"stack">) {
  return (
    <section id={id} className={cn(CWRAP, "scroll-mt-20 pt-6 pb-14 @3xl:pb-18")}>
      <SectionHead label={s.label} title={s.title} />
      <ul className="grid grid-cols-[minmax(0,1fr)] border-t border-line @3xl:grid-cols-2 @3xl:gap-x-12">
        {s.items.map((skill, i) => (
          <li key={`${skill.name}-${i}`} className="flex flex-col gap-3 border-b border-line py-5">
            <div className="flex items-start justify-between gap-4">
              <span className="flex min-w-0 flex-col gap-0.5">
                <b className="text-lg font-medium">{skill.name}</b>
                {skill.note && <span className="text-sm text-muted">{skill.note}</span>}
              </span>
              {skill.grade && (
                <span className="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] px-2.5 py-1 font-mono text-[12px] tracking-wide text-accent uppercase">
                  {ru.builder.grades[skill.grade]}
                </span>
              )}
            </div>
            {skill.level > 0 && (
              <div className="flex items-center gap-3">
                <span
                  role="meter"
                  aria-label={skill.name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={skill.level}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised"
                >
                  <span
                    style={{ width: `${skill.level}%` }}
                    className="block h-full rounded-full bg-accent shadow-[0_0_12px_var(--glow)]"
                  />
                </span>
                <span className="w-10 text-right font-mono text-[13px] text-muted">
                  {skill.level}%
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const CONTACT_ICON: Record<ContactKind, IconName> = {
  telegram: "send",
  github: "github",
  email: "mail",
  phone: "phone",
  vk: "link",
  linkedin: "linkedin",
  website: "globe",
};

function Contacts({ id, settings: s }: Props<"contacts">) {
  return (
    <section id={id} className={cn(CWRAP, "scroll-mt-20 pt-20 pb-16 @3xl:pt-24 @3xl:pb-18")}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @4xl:gap-16">
        <h2 className="font-display text-ch2xl font-medium">
          {s.title}
          {s.title_muted && <span className="text-muted"> {s.title_muted}</span>}
        </h2>
        <div className="flex flex-col">
          {s.items.map((c, i) => (
            <a
              key={i}
              href={c.url}
              {...externalProps(c.url)}
              className="group/c flex min-h-20 items-center gap-4 border-b border-line py-4 transition-[padding] duration-200 ease-neon first:border-t hover:pl-2"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#eef1f6] text-[#0a0d14]">
                <Icon name={CONTACT_ICON[c.kind]} size={22} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="label">{c.label}</span>
                <b className="truncate text-lg font-medium">{c.value}</b>
              </span>
              <Icon
                name="external"
                className="text-muted transition-[transform,color] duration-200 ease-neon group-hover/c:translate-x-0.5 group-hover/c:-translate-y-0.5 group-hover/c:text-accent"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Resume({ id, settings: s }: Props<"resume">) {
  if (!s.file) return null;
  return (
    <section id={id} className={CWRAP}>
      <div className="flex items-center gap-3 border-t border-line py-8">
        <Icon name="download" size={18} className="text-accent" />
        <a href={s.file.url} download className={accentLink}>
          {s.label}
        </a>
        <span className="font-mono text-[13px] text-muted">PDF</span>
      </div>
    </section>
  );
}

const RENDERERS: { [T in AnyBlock["type"]]: (props: Props<T>) => ReactNode } = {
  hero: Hero,
  facts: Facts,
  experience: Experience,
  projects: Projects,
  interests: Interests,
  stack: StackBlock,
  contacts: Contacts,
  resume: Resume,
  ...PERSONAL_RENDERERS,
  ...MEDIA_RENDERERS,
  ...COLLAGE_RENDERERS,
};

/** Renders visible blocks; a block that fails to render never breaks the page. */
export function Blocks({ blocks, ctx }: { blocks: readonly AnyBlock[]; ctx: RenderContext }) {
  return (
    <>
      {blocks
        .filter((b) => !b.hidden)
        .map((block) => {
          const Render = RENDERERS[block.type] as (props: Props<typeof block.type>) => ReactNode;
          return Render ? (
            <SectionFrame key={block.id} appearance={block.appearance}>
              <Render id={anchorId(block)} settings={block.settings} ctx={ctx} />
            </SectionFrame>
          ) : null;
        })}
    </>
  );
}
