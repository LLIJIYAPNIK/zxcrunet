/**
 * Renders of the personal blocks (reference «Профиль · личное»). Blocks keep presentation;
 * the content comes from `ctx.catalog`. Pure components: server and editor preview alike.
 */
import Image from "next/image";
import type { ReactNode } from "react";

import { CoverArt, Segments, Thumb, TitleCard } from "@/components/catalog/pieces";
import { ShelfBrowser } from "@/components/catalog/ShelfBrowser";
import { Pattern } from "@/components/public/Pattern";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import {
  KIND_PATH,
  favoriteCharacters,
  finishedByMonth,
  formatDate,
  genreCounts,
  initials,
  nowPlaying,
  progressText,
  progressValue,
  sortTitles,
  statusText,
  titleHref,
  works,
  yearsText,
  type CatalogIndex,
  type Title,
} from "@/lib/catalog/catalog";
import { ru } from "@/i18n/ru";

import type { AnyBlock } from "./schemas";
import {
  CARD,
  CWRAP,
  Cover,
  LIFT,
  SectionHead,
  SmartLink,
  accentLink,
  externalProps,
  type BlockProps as Props,
} from "./ui";

const c = ru.catalog;
const SECTION = "scroll-mt-20 pt-16 pb-6 @3xl:pt-24";

/** Shelf content of a kind: works that are on the shelf. */
function shelfOf(index: CatalogIndex, kind: Title["kind"]): Title[] {
  return works(index.ofKind(kind)).filter((t) => t.entry);
}

/** Shown in the editor preview only, where an empty block would just vanish. */
function EmptyHint({ id, label }: { id: string; label: string }) {
  return (
    <section id={id} className={cn(CWRAP, "py-8")} data-empty-hint>
      <p className="rounded-lg border border-dashed border-line-2 p-6 text-ink-2">
        <b className="font-medium text-ink">{label}.</b> {c.blocks.emptyShelf}
      </p>
    </section>
  );
}

function TitleAnchor({
  title,
  className,
  children,
}: {
  title: Title;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={titleHref(title)} className={className}>
      {children}
    </a>
  );
}

// --- profile ---------------------------------------------------------------------------

function Profile({ id, settings: s, ctx }: Props<"profile">) {
  return (
    <header id={id}>
      <div className="relative h-[180px] overflow-hidden bg-raised @3xl:h-[300px]">
        {s.cover ? (
          <Cover media={s.cover} sizes="100vw" className="object-[50%_40%]" />
        ) : (
          <Pattern pattern={s.pattern ?? "glow"} fade="top" />
        )}
      </div>
      <div className={CWRAP}>
        <div
          className="relative flex flex-col items-start gap-5 @3xl:flex-row @3xl:gap-8"
          data-enter
        >
          <span className="-mt-14 size-28 shrink-0 rounded-full border-2 border-accent bg-bg p-1 shadow-[0_0_28px_var(--glow)] @3xl:-mt-[72px] @3xl:size-[156px] @3xl:p-[5px]">
            {s.avatar ? (
              <span className="relative block size-full overflow-hidden rounded-full">
                <Cover media={s.avatar} sizes="156px" />
              </span>
            ) : (
              <span className="grid size-full place-items-center rounded-full bg-raised font-display text-[28px] font-medium text-accent @3xl:text-[40px]">
                {initials(ctx.siteTitle)}
              </span>
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3 @3xl:pt-7">
            <h1 className="font-display text-ch2xl font-medium">{s.title}</h1>
            {s.lead && (
              <p className="max-w-[40em] text-[17px] whitespace-pre-line text-ink-2">{s.lead}</p>
            )}
          </div>
          {s.mood && (
            <span className="inline-flex h-10 items-center gap-2.5 rounded-full border border-line-2 px-4 text-sm font-medium whitespace-nowrap @3xl:mt-8">
              <i className="size-2 rounded-full bg-accent" aria-hidden="true" />
              {s.mood}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// --- now -------------------------------------------------------------------------------

const TONES = ["accent", "second", "ink"] as const;

function Now({ id, settings: s, ctx }: Props<"now">) {
  const items = nowPlaying(ctx.catalog.catalog, s.kinds, s.limit);
  if (!items.length) return ctx.preview ? <EmptyHint id={id} label={c.blocks.now} /> : null;
  return (
    <section id={id} aria-label={s.label || c.blocks.now} className={cn(CWRAP, "pt-10 @3xl:pt-14")}>
      {s.label && <span className="label mb-4 block">{s.label}</span>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @3xl:grid-cols-3 @3xl:gap-6">
        {items.map((t, i) => {
          const value = progressValue(t);
          return (
            <TitleAnchor
              key={t.id}
              title={t}
              className={cn(CARD, LIFT, "flex flex-col gap-2.5 p-6")}
            >
              <span className={cn("label", i === 0 && "text-accent")}>
                {statusText(t.kind, "active")}
              </span>
              <b className="font-display text-lg leading-snug font-medium">{t.name}</b>
              <ProgressBar
                value={value ?? (t.kind === "game" ? 0.5 : 0)}
                tone={TONES[i % TONES.length]}
                label={progressText(t) || t.name}
                className="mt-1.5"
              />
              {progressText(t) && <span className="label">{progressText(t)}</span>}
            </TitleAnchor>
          );
        })}
      </div>
    </section>
  );
}

// --- shelf -----------------------------------------------------------------------------

function ShelfHead({ s, kindTitle }: { s: Props<"shelf">["settings"]; kindTitle: string }) {
  return (
    <SectionHead
      label={s.label}
      title={s.title || kindTitle}
      aside={s.all_link ? <SmartLink link={s.all_link} className={accentLink} /> : undefined}
    />
  );
}

function Bento({ items, index }: { items: Title[]; index: CatalogIndex }) {
  // The biggest series first, as a tall card with its parts; then what is in progress.
  const seriesIds = [...new Set(items.map((t) => t.series_id).filter(Boolean))] as string[];
  const series = seriesIds
    .map((sid) => index.get(sid))
    .filter((t): t is Title => !!t)
    .sort((a, b) => index.parts(b).length - index.parts(a).length)[0];
  const parts = series ? index.parts(series) : [];
  const active = items.find((t) => t.entry?.status === "active" && t.series_id !== series?.id);
  const rest = items.filter((t) => t !== active && (!series || t.series_id !== series.id));
  const hours = items.reduce((sum, t) => sum + (t.entry?.hours ?? 0), 0);
  const genres = genreCounts(items).slice(0, 3);
  const cell = cn(CARD, "relative flex flex-col gap-1.5 overflow-hidden p-6");

  return (
    <div className="grid auto-rows-[minmax(176px,auto)] grid-cols-2 gap-4 @4xl:grid-cols-4 @4xl:gap-6">
      {series && (
        <TitleAnchor
          title={series}
          className={cn(cell, LIFT, "col-span-2 row-span-2 min-h-[376px]")}
        >
          <span className="relative -mx-6 -mt-6 mb-4 min-h-[180px] flex-1 overflow-hidden">
            <CoverArt title={series} bare sizes="(min-width: 1024px) 50vw, 100vw" />
          </span>
          <span className="label">
            {c.shelf.series} · {c.shelf.parts.replace("{n}", String(parts.length))}
          </span>
          <b className="font-display text-[32px] leading-tight font-medium tracking-[-0.02em]">
            {series.name}
          </b>
          <span className="mt-2 flex flex-wrap gap-2">
            {parts.map((p) => (
              <Chip key={p.id} variant={p.entry?.status === "done" ? "fill" : "default"}>
                {[p.part_label, p.year].filter(Boolean).join(" · ") || p.name}
              </Chip>
            ))}
          </span>
        </TitleAnchor>
      )}
      {active && (
        <TitleAnchor title={active} className={cn(cell, LIFT, "col-span-2")}>
          <span className="label text-accent">{statusText(active.kind, "active")}</span>
          <b className="font-display text-xl leading-tight font-medium">{active.name}</b>
          {progressText(active) && <span className="text-muted">{progressText(active)}</span>}
          <ProgressBar
            value={progressValue(active) ?? 0.5}
            label={progressText(active) || active.name}
            className="mt-auto"
          />
        </TitleAnchor>
      )}
      {rest.slice(0, 4).map((t) => (
        <TitleAnchor key={t.id} title={t} className={cn(cell, LIFT)}>
          <b className="font-display text-xl leading-tight font-medium">{t.name}</b>
          <span className="mt-auto text-muted">{t.genres[0] ?? yearsText(t)}</span>
        </TitleAnchor>
      ))}
      {hours > 0 && (
        <div className={cell}>
          <span className="label">{c.shelf.forYear}</span>
          <span className="mt-auto font-display text-[44px] leading-none font-medium tracking-[-0.03em]">
            {hours}
            <small className="text-xl text-muted"> {c.shelf.hoursUnit}</small>
          </span>
        </div>
      )}
      {genres.length > 1 && (
        <div className={cn(cell, "col-span-2")}>
          <span className="label">{c.shelf.genres}</span>
          <span className="mt-auto mb-3 flex h-2.5 gap-[3px] overflow-hidden rounded-full">
            {genres.map((g, i) => (
              <i
                key={g.genre}
                style={{ flex: g.count }}
                className={["bg-accent", "bg-ink-2", "bg-muted"][i]}
              />
            ))}
          </span>
          <span className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            {genres.map((g, i) => (
              <span key={g.genre} className="flex items-center gap-2">
                <i
                  className={cn("size-2 rounded-full", ["bg-accent", "bg-ink-2", "bg-muted"][i])}
                />
                {g.genre} · {g.count}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** The thinnest spine still fits a 13px vertical line of text with some air around it. */
export const SPINE_MIN_WIDTH = 40;

/** Deterministic height and width for a spine, from the title id. */
export function spineSize(t: Title): { height: number; width: number } {
  let hash = 0;
  for (const ch of t.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  // `>>>`, not `>>`: a signed shift made big hashes negative and spines too thin to read.
  return { height: 220 + (hash % 80), width: SPINE_MIN_WIDTH + ((hash >>> 8) % 26) };
}

function Spines({ items }: { items: Title[] }) {
  return (
    <div className="flex h-[300px] items-end gap-1.5 overflow-x-auto border-b-[3px] border-line-2">
      {items.map((t) => {
        const size = spineSize(t);
        return (
          <TitleAnchor
            key={t.id}
            title={t}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-t-[4px] border border-b-0 border-line bg-raised transition-transform duration-200 ease-neon hover:-translate-y-1.5",
              t.entry?.favorite && "border-t-4 border-t-accent",
              t.entry?.status === "active" && "border-t-4 border-t-second",
            )}
          >
            <span
              title={t.name}
              style={{ height: size.height, width: size.width }}
              className="flex items-center justify-center overflow-hidden"
            >
              <span className="max-h-full rotate-180 truncate py-3 text-[13px] font-medium text-ink-2 [writing-mode:vertical-rl]">
                {t.name}
              </span>
            </span>
          </TitleAnchor>
        );
      })}
    </div>
  );
}

function Tickets({ items }: { items: Title[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @3xl:grid-cols-2 @3xl:gap-6">
      {items.map((t) => {
        const place = t.entry?.details.place ?? "";
        return (
          <TitleAnchor
            key={t.id}
            title={t}
            className="grid min-h-[168px] grid-cols-[minmax(0,1fr)_96px] overflow-hidden rounded-lg border border-line bg-surface transition-[transform,border-color] duration-200 ease-neon hover:-translate-y-0.5 hover:border-line-2 @lg:grid-cols-[minmax(0,1fr)_120px]"
          >
            <span
              className={cn(
                "flex flex-col gap-1.5 border-l-4 p-6",
                t.entry?.favorite ? "border-l-accent" : "border-l-line-2",
              )}
            >
              <span className="label">
                {place || statusText(t.kind, t.entry?.status ?? "done")}
              </span>
              <b className="font-display text-[22px] leading-tight font-medium">{t.name}</b>
              <span className="text-muted">
                {[t.creator, yearsText(t)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="relative flex flex-col items-center justify-center gap-1 border-l border-dashed border-line-2 before:absolute before:-top-[9px] before:-left-[9px] before:size-4 before:rounded-full before:bg-bg after:absolute after:-bottom-[9px] after:-left-[9px] after:size-4 after:rounded-full after:bg-bg">
              <span className="label">{c.shelf.score}</span>
              <span className="font-display text-[34px] leading-none font-medium tracking-[-0.03em]">
                {t.entry?.rating ?? "—"}
              </span>
            </span>
          </TitleAnchor>
        );
      })}
    </div>
  );
}

function Tracker({ items }: { items: Title[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((t) => {
        const total = t.entry?.progress_total ?? 0;
        const done = t.entry?.progress ?? (t.entry?.status === "done" ? total : 0);
        return (
          <TitleAnchor key={t.id} title={t} className={cn(CARD, LIFT, "flex flex-col gap-3 p-6")}>
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <b className="font-display text-xl leading-snug font-medium">{t.name}</b>
              <span className="label">
                {[yearsText(t), progressText(t)].filter(Boolean).join(" · ")}
              </span>
            </span>
            {total > 0 && (
              <Segments total={total} done={done} current={t.entry?.status === "active"} />
            )}
          </TitleAnchor>
        );
      })}
    </div>
  );
}

function Shelf({ id, settings: s, ctx }: Props<"shelf">) {
  const kindTitle = c.kinds[s.kind];
  const all = shelfOf(ctx.catalog, s.kind);
  if (!all.length) return ctx.preview ? <EmptyHint id={id} label={kindTitle} /> : null;
  const items = sortTitles(all, "recent").slice(0, s.limit);

  let body: ReactNode;
  if (s.controls) {
    const series = Object.fromEntries(
      all
        .map((t) => ctx.catalog.series(t))
        .filter((t): t is Title => !!t)
        .map((t) => [t.id, t]),
    );
    body = (
      <ShelfBrowser
        kind={s.kind}
        titles={all}
        series={series}
        storageKey={`zxc-shelf:${ctx.address}:${id}`}
      />
    );
  } else if (s.style === "bento") {
    body = <Bento items={items} index={ctx.catalog} />;
  } else if (s.style === "spines") {
    body = <Spines items={items} />;
  } else if (s.style === "tickets") {
    body = <Tickets items={items} />;
  } else if (s.style === "tracker") {
    body = <Tracker items={items} />;
  } else {
    body = (
      <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-3 @3xl:gap-6 @5xl:grid-cols-4">
        {items.map((t) => (
          <TitleCard key={t.id} title={t} />
        ))}
      </div>
    );
  }

  return (
    <section id={id} className={cn(CWRAP, SECTION)} data-shelf={KIND_PATH[s.kind]}>
      <ShelfHead s={s} kindTitle={kindTitle} />
      {s.lead && <p className="-mt-4 mb-8 max-w-[36em] text-[17px] text-ink-2">{s.lead}</p>}
      {body}
    </section>
  );
}

// --- characters ------------------------------------------------------------------------

function Characters({ id, settings: s, ctx }: Props<"characters">) {
  const people = favoriteCharacters(ctx.catalog.catalog);
  if (!people.length)
    return ctx.preview ? <EmptyHint id={id} label={s.title || c.blocks.characters} /> : null;
  return (
    <section id={id} aria-label={s.title || c.blocks.characters} className={cn(CWRAP, SECTION)}>
      <SectionHead label={s.label} title={s.title} />
      <div className="grid grid-cols-2 gap-6 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-6">
        {people.map((p, i) => (
          <TitleAnchor
            key={`${p.title.id}-${p.name}`}
            title={p.title}
            className="group/r flex flex-col items-center gap-1.5 text-center"
          >
            <span
              className={cn(
                "mb-2.5 size-24 rounded-full border-2 p-1 transition-transform duration-200 ease-neon group-hover/r:-translate-y-0.5 @3xl:size-[132px]",
                i % 2 ? "border-line-2" : "border-accent",
              )}
            >
              <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-raised font-display text-2xl font-medium @3xl:text-[30px]">
                {p.avatar ? (
                  <Image
                    src={p.avatar.url}
                    alt=""
                    fill
                    sizes="132px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  initials(p.name)
                )}
              </span>
            </span>
            <b className="font-medium">{p.name}</b>
            <span className="label">{p.title.name}</span>
          </TitleAnchor>
        ))}
      </div>
    </section>
  );
}

// --- top -------------------------------------------------------------------------------

function Top({ id, settings: s, ctx }: Props<"top">) {
  const items = s.items.map((tid) => ctx.catalog.get(tid)).filter((t): t is Title => !!t);
  if (!items.length) return ctx.preview ? <EmptyHint id={id} label={s.title || "Топ"} /> : null;
  return (
    <section id={id} className={cn(CWRAP, SECTION)}>
      <SectionHead label={s.label} title={s.title} />
      <ol className="border-t border-line">
        {items.map((t, i) => (
          <li key={t.id}>
            <TitleAnchor
              title={t}
              className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 border-b border-line py-5 transition-[padding] duration-200 ease-neon hover:pl-2 @3xl:grid-cols-[120px_minmax(0,1fr)_auto] @3xl:gap-6"
            >
              <span className="font-display text-[40px] leading-none font-medium tracking-[-0.04em] text-accent @3xl:text-[64px]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <b className="font-display text-xl leading-tight font-medium @3xl:text-2xl">
                  {t.name}
                </b>
                <span className="text-muted">
                  {[t.creator, yearsText(t)].filter(Boolean).join(" · ")}
                </span>
              </span>
              {t.entry && (
                <Chip
                  variant={t.entry.favorite ? "fill" : "default"}
                  className="col-start-2 w-max @3xl:col-start-auto"
                >
                  {t.entry.favorite ? c.fields.favorite : statusText(t.kind, t.entry.status)}
                </Chip>
              )}
            </TitleAnchor>
          </li>
        ))}
      </ol>
    </section>
  );
}

// --- challenge -------------------------------------------------------------------------

function Challenge({ id, settings: s, ctx }: Props<"challenge">) {
  const months = finishedByMonth(ctx.catalog.catalog, s.kind, s.year);
  const total = months.reduce((a, b) => a + b, 0);
  const perMonth = s.goal / 12;
  return (
    <section id={id} className={cn(CWRAP, "pt-10 pb-6")}>
      <div className={cn(CARD, "max-w-xl p-7")}>
        <span className="label">{s.label || `${s.year}`}</span>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-cstat font-medium">{total}</span>
          <span className="text-muted">
            {c.blocks.challengeOf.replace("{goal}", String(s.goal))} ·{" "}
            {c.kinds[s.kind].toLowerCase()} · {s.year}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-12 gap-1" role="img" aria-label={c.blocks.months}>
          {months.map((n, i) => (
            <i
              key={i}
              title={`${c.blocks.monthNames[i]}: ${n}`}
              className={cn(
                "h-7 rounded-[4px]",
                n >= Math.max(1, perMonth)
                  ? "bg-accent"
                  : n > 0
                    ? "bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
                    : "bg-line",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// --- quotes ----------------------------------------------------------------------------

function Quotes({ id, settings: s, ctx }: Props<"quotes">) {
  return (
    <section id={id} aria-label={s.title || "Цитаты"} className={cn(CWRAP, SECTION)}>
      <SectionHead label={s.label} title={s.title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @4xl:grid-cols-2 @4xl:gap-6">
        {s.items.map((q, i) => {
          const title = ctx.catalog.get(q.title_id);
          return (
            <figure key={i} className={cn(CARD, "p-7")}>
              <div
                className="h-9 font-display text-[64px] leading-none font-medium text-accent"
                aria-hidden="true"
              >
                “
              </div>
              <blockquote className="mt-3 font-display text-[22px] leading-[1.45] font-medium tracking-[-0.01em] whitespace-pre-line">
                {q.text}
              </blockquote>
              {(q.source || title) && (
                <figcaption className="mt-4 text-[15px] text-muted italic">
                  {title ? (
                    <TitleAnchor title={title} className="hover:text-ink">
                      {q.source || title.name}
                    </TitleAnchor>
                  ) : (
                    q.source
                  )}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

// --- playlist --------------------------------------------------------------------------

function Playlist({ id, settings: s, ctx }: Props<"playlist">) {
  return (
    <section id={id} aria-label={s.title || "Плейлист"} className={cn(CWRAP, SECTION)}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 @4xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] @4xl:gap-6">
        <div>
          {s.label && <span className="label">{s.label}</span>}
          {s.title && <h2 className="mt-3 font-display text-ch2 font-medium">{s.title}</h2>}
          {s.lead && <p className="mt-4 text-ink-2">{s.lead}</p>}
        </div>
        <ol className="border-t border-line">
          {s.items.map((t, i) => {
            const title = ctx.catalog.get(t.title_id);
            const play =
              "grid size-11 shrink-0 place-items-center rounded-full border border-line-2 transition-[border-color,color,transform] duration-200 ease-neon";
            return (
              <li
                key={i}
                className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-line py-3 @lg:grid-cols-[44px_minmax(0,1fr)_auto]"
              >
                {t.url ? (
                  <a
                    href={t.url}
                    {...externalProps(t.url)}
                    aria-label={c.blocks.listen.replace("{track}", t.track)}
                    className={cn(play, "hover:border-accent hover:text-accent active:scale-95")}
                  >
                    <Icon name="play" size={16} />
                  </a>
                ) : (
                  <span className={cn(play, "font-mono text-[13px] text-muted")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
                <span className="min-w-0">
                  <b className="block truncate font-medium">{t.track}</b>
                  {t.artist && <span className="text-muted">{t.artist}</span>}
                </span>
                {title && (
                  <TitleAnchor
                    title={title}
                    className="col-start-2 flex h-8 w-max items-center rounded-full border border-line-2 px-3.5 text-sm text-ink-2 transition-colors hover:border-accent @lg:col-start-auto"
                  >
                    {title.name}
                  </TitleAnchor>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// --- posts -----------------------------------------------------------------------------

function Posts({ id, settings: s, ctx }: Props<"posts">) {
  const posts = ctx.catalog.catalog.posts
    .filter((p) => s.kind === "all" || p.kind === s.kind)
    .slice(0, s.limit);
  if (!posts.length) return ctx.preview ? <EmptyHint id={id} label={s.title || c.posts} /> : null;
  return (
    <section id={id} className={cn(CWRAP, SECTION, "pb-16")}>
      <SectionHead label={s.label} title={s.title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @4xl:grid-cols-2 @4xl:gap-6">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} title={ctx.catalog.get(p.title_id)} />
        ))}
      </div>
    </section>
  );
}

export function PostCard({
  post,
  title,
  large = false,
}: {
  post: { kind: "review" | "note"; heading: string; body: string; published_on: string };
  title?: Title;
  large?: boolean;
}) {
  return (
    <article className={cn(CARD, "flex flex-col gap-3 p-6 @lg:p-8")}>
      <span className="label">
        <b className="font-medium text-accent">{c.postKinds[post.kind]}</b> ·{" "}
        {formatDate(post.published_on)}
      </span>
      <h3
        className={cn("font-display font-medium", large ? "text-[32px] leading-tight" : "text-h3")}
      >
        {post.heading}
      </h3>
      {post.body && <p className="whitespace-pre-line text-ink-2">{post.body}</p>}
      {title && (
        <TitleAnchor
          title={title}
          className="mt-3 flex items-center gap-3.5 rounded-md border border-line bg-raised p-2.5 transition-colors hover:border-line-2"
        >
          <Thumb title={title} className="size-14" />
          <span className="min-w-0 flex-1">
            <b className="block truncate font-medium">{title.name}</b>
            <span className="text-muted">
              {[c.kindOne[title.kind].toLowerCase(), yearsText(title)].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className={cn(accentLink, "mr-2")}>{c.blocks.open}</span>
        </TitleAnchor>
      )}
    </article>
  );
}

type PersonalType = Extract<
  AnyBlock["type"],
  "profile" | "now" | "shelf" | "characters" | "top" | "challenge" | "quotes" | "playlist" | "posts"
>;

export const PERSONAL_RENDERERS: { [T in PersonalType]: (props: Props<T>) => ReactNode } = {
  profile: Profile,
  now: Now,
  shelf: Shelf,
  characters: Characters,
  top: Top,
  challenge: Challenge,
  quotes: Quotes,
  playlist: Playlist,
  posts: Posts,
};
