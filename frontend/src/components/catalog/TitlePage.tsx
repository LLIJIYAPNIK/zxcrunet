/**
 * The page of a title or a series (reference «Игра · серия Dark Souls»): built from the
 * catalog entry, every section appears only when there is something to show.
 */
import Image from "next/image";

import { PostCard } from "@/blocks/personal";
import { CARD, CWRAP, LIFT, externalProps } from "@/blocks/ui";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  details,
  initials,
  progressText,
  seriesStats,
  statusText,
  titleHref,
  yearsText,
  type CatalogIndex,
  type Title,
} from "@/lib/catalog/catalog";
import { ru } from "@/i18n/ru";

import { CoverArt, RatingCells, StatusBadge, Thumb } from "./pieces";
import { Spoilers } from "./Spoilers";

const c = ru.catalog;
const p = c.page;
const SECTION = cn(CWRAP, "pt-16 @3xl:pt-24");

function Kv({ items }: { items: [string, string][] }) {
  const shown = items.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <dl className="mt-4 grid grid-cols-2 border-t border-line-2 @3xl:grid-cols-4">
      {shown.map(([label, value], i) => (
        <div
          key={label}
          className={cn(
            "flex flex-col gap-2 border-line pt-5 pr-6",
            i % 2 === 1 && "border-l border-line pl-6",
            i > 1 && "mt-4 @3xl:mt-0",
            i >= 1 && "@3xl:border-l @3xl:pl-6",
          )}
        >
          <dt className="label">{label}</dt>
          <dd className="font-display text-2xl leading-tight font-medium tracking-[-0.02em]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PartCard({ part }: { part: Title }) {
  const extras = details(part).extras;
  return (
    <article className={cn(CARD, "flex min-h-[260px] flex-col gap-3.5 p-6 @lg:p-8")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-muted">{part.year ?? part.part_label}</span>
        <StatusBadge title={part} />
      </div>
      <h3 className="font-display text-2xl font-medium">
        <a href={titleHref(part)} className="hover:text-accent">
          {part.name}
        </a>
      </h3>
      {(part.entry?.hours ?? 0) > 0 && (
        <span className="label">{p.hoursShort.replace("{n}", String(part.entry!.hours))}</span>
      )}
      {extras.length > 0 && (
        <ul className="mt-auto flex flex-col gap-2.5 border-t border-line pt-4">
          <li className="label">{p.extras}</li>
          {extras.map((x) => (
            <li key={x.name} className="flex items-center gap-2.5 text-[15px] text-ink-2">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full border-[1.5px]",
                  x.done ? "border-accent bg-accent" : "border-line-2",
                )}
              />
              {x.name}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function TitlePage({ title, index }: { title: Title; index: CatalogIndex }) {
  const d = details(title);
  const stats = seriesStats(index, title);
  const parent = index.series(title);
  const family = index.family(title);
  const partLabels = title.is_series ? stats.parts.map((x) => x.part_label).filter(Boolean) : [];
  const posts = index.postsAbout(title);
  const bossGroups = family
    .map((x) => ({ title: x, bosses: details(x).bosses }))
    .filter((g) => g.bosses.length);
  const tracks = family.flatMap((x) =>
    details(x).tracks.map((tr) => ({ ...tr, part: tr.part || (x === title ? "" : x.part_label) })),
  );
  const shots = family.flatMap((x) => details(x).screenshots);

  const label = [
    title.is_series ? c.seriesOf[title.kind] : c.kindOne[title.kind],
    title.creator,
    yearsText(title),
  ]
    .filter(Boolean)
    .join(" · ");

  const kv: [string, string][] = title.is_series
    ? [
        [
          p.partsDone,
          p.outOf.replace("{n}", String(stats.done)).replace("{total}", String(stats.parts.length)),
        ],
        [p.hoursInSeries, stats.hours ? p.hoursShort.replace("{n}", String(stats.hours)) : ""],
        [p.rating, stats.rating ? p.ofTen.replace("{n}", String(stats.rating)) : ""],
        [p.favoritePart, d.favorite_part],
      ]
    : [
        [p.status, title.entry ? statusText(title.kind, title.entry.status) : ""],
        [
          title.kind === "game" ? p.hours : c.progressUnit[title.kind],
          title.kind === "game"
            ? title.entry?.hours
              ? p.hoursShort.replace("{n}", String(title.entry.hours))
              : ""
            : progressText(title),
        ],
        [p.rating, title.entry?.rating ? p.ofTen.replace("{n}", String(title.entry.rating)) : ""],
        [p.year, yearsText(title)],
      ];

  return (
    <article>
      <header>
        <div className="relative h-[220px] overflow-hidden bg-raised @3xl:h-[460px]">
          <CoverArt title={title} bare sizes="100vw" className="object-[50%_35%]" />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg to-transparent"
          />
        </div>
        <div className={cn(CWRAP, "flex flex-col gap-5 pt-10 @3xl:pt-14")} data-enter>
          <span className="label text-ink-2">
            {parent ? (
              <a href={titleHref(parent)} className="hover:text-ink">
                {parent.name}
                {title.part_label && ` · ${title.part_label}`}
              </a>
            ) : (
              label
            )}
          </span>
          <h1 className="font-display text-[clamp(2.75rem,1.5rem+7cqi,6rem)] leading-[1.02] font-medium tracking-[-0.045em]">
            {title.name}
          </h1>
          {title.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {title.genres.map((g) => (
                <Chip key={g}>{g}</Chip>
              ))}
            </div>
          )}
          {title.description && (
            <p className="max-w-[40em] text-clead whitespace-pre-line text-ink-2">
              {title.description}
            </p>
          )}
          <Kv items={kv} />
        </div>
      </header>

      {title.is_series && stats.parts.length > 0 && (
        <section aria-label={p.parts} className={SECTION}>
          <h2 className="mb-8 font-display text-ch2 font-medium @3xl:mb-12">{p.parts}</h2>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @3xl:grid-cols-2 @3xl:gap-6 @5xl:grid-cols-3">
            {stats.parts.map((part) => (
              <PartCard key={part.id} part={part} />
            ))}
          </div>
        </section>
      )}
      {!title.is_series && d.extras.length > 0 && (
        <section aria-label={p.extras} className={SECTION}>
          <div className="max-w-md">
            <PartCard part={title} />
          </div>
        </section>
      )}

      {(d.criteria.length > 0 || d.plot.length > 0) && (
        <section className={SECTION}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-16 @4xl:grid-cols-2 @4xl:gap-6">
            {d.criteria.length > 0 && (
              <div>
                <h2 className="mb-10 font-display text-ch2 font-medium">{p.criteria}</h2>
                <div className="flex flex-col gap-5">
                  {d.criteria.map((cr) => (
                    <RatingCells key={cr.name} name={cr.name} value={cr.score} />
                  ))}
                </div>
              </div>
            )}
            {d.plot.length > 0 && (
              <Spoilers
                title={p.plot}
                sections={d.plot.map((s) => ({
                  label: s.label ?? "",
                  text: s.text,
                  spoiler: s.spoiler ?? true,
                }))}
              />
            )}
          </div>
        </section>
      )}

      {d.characters.length > 0 && (
        <section aria-label={p.characters} className={SECTION}>
          <h2 className="mb-8 font-display text-ch2 font-medium @3xl:mb-12">
            {p.characters}
            {partLabels.length > 0 && <span className="text-muted"> {p.charactersMuted}</span>}
          </h2>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @3xl:grid-cols-2 @3xl:gap-6 @5xl:grid-cols-3">
            {d.characters.map((ch) => (
              <div key={ch.name} className={cn(CARD, "flex items-center gap-4 p-6")}>
                <span
                  className={cn(
                    "size-16 shrink-0 rounded-full border-2 p-[3px]",
                    ch.favorite ? "border-accent" : "border-line-2",
                  )}
                >
                  <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-raised font-display text-lg font-medium">
                    {ch.avatar ? (
                      <Image
                        src={ch.avatar.url}
                        alt=""
                        fill
                        sizes="64px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      initials(ch.name)
                    )}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block text-[17px] font-medium">
                    {ch.name}
                    {ch.favorite && (
                      <span className="ml-2 text-xs font-medium text-accent">
                        {p.favoriteCharacter}
                      </span>
                    )}
                  </b>
                  {ch.role && <span className="text-sm text-muted">{ch.role}</span>}
                  {partLabels.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {partLabels.map((part) => {
                        const on = (ch.parts ?? []).includes(part);
                        return (
                          <span
                            key={part}
                            className={cn(
                              "grid h-6 min-w-8 place-items-center rounded-[6px] border px-1.5 font-mono text-xs font-medium",
                              on ? "border-line-2 bg-raised text-accent" : "border-line text-muted",
                            )}
                          >
                            {part}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(bossGroups.length > 0 || tracks.length > 0) && (
        <section className={SECTION}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-16 @4xl:grid-cols-2 @4xl:gap-6">
            {bossGroups.length > 0 && (
              <div className="flex flex-col gap-12">
                {bossGroups.map((g) => {
                  const defeated = g.bosses.filter((b) => b.defeated).length;
                  return (
                    <div key={g.title.id}>
                      <div className="mb-8 flex items-baseline justify-between gap-4">
                        <h2 className="font-display text-ch2 font-medium">
                          {p.bosses}
                          {g.title !== title && g.title.part_label && ` · ${g.title.part_label}`}
                        </h2>
                        <span className="font-display text-[28px] font-medium">
                          {p.outOf
                            .replace("{n}", String(defeated))
                            .replace("{total}", String(g.bosses.length))}
                        </span>
                      </div>
                      <ul className="border-t border-line">
                        {g.bosses.map((b) => (
                          <li
                            key={b.name}
                            className="flex min-h-14 items-center gap-3.5 border-b border-line"
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "grid size-[22px] shrink-0 place-items-center rounded-[6px] border-[1.5px]",
                                b.defeated
                                  ? "border-accent bg-accent text-accent-ink"
                                  : "border-line-2",
                              )}
                            >
                              {b.defeated && <Icon name="check" size={14} strokeWidth={3} />}
                            </span>
                            <span
                              className={cn(
                                "flex-1 font-medium",
                                b.defeated && "text-muted line-through decoration-line-2",
                              )}
                            >
                              <span className="sr-only">{b.defeated ? "✓ " : ""}</span>
                              {b.name}
                            </span>
                            {b.note && <span className="label">{b.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            {tracks.length > 0 && (
              <div>
                <h2 className="mb-8 font-display text-ch2 font-medium">{p.tracks}</h2>
                <ol className={cn(CARD, "px-6 py-3")}>
                  {tracks.map((tr, i) => (
                    <li
                      key={`${tr.title}-${i}`}
                      className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-3 first:border-t-0"
                    >
                      {tr.url ? (
                        <a
                          href={tr.url}
                          {...externalProps(tr.url)}
                          aria-label={c.blocks.listen.replace("{track}", tr.title)}
                          className="grid size-9 place-items-center rounded-full border border-line-2 hover:border-accent hover:text-accent"
                        >
                          <Icon name="play" size={14} />
                        </a>
                      ) : (
                        <span className="font-mono text-muted">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate">{tr.title}</span>
                        {tr.artist && <span className="text-sm text-muted">{tr.artist}</span>}
                      </span>
                      {tr.part ? (
                        <span className="grid h-6 min-w-8 place-items-center rounded-[6px] border border-line-2 bg-raised px-1.5 font-mono text-xs text-accent">
                          {tr.part}
                        </span>
                      ) : (
                        <span />
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}

      {shots.length > 0 && (
        <section aria-label={p.screenshots} className={SECTION}>
          <h2 className="mb-8 font-display text-ch2 font-medium @3xl:mb-12">{p.screenshots}</h2>
          <div className="grid auto-rows-[140px] grid-cols-2 gap-0.5 overflow-hidden rounded-lg @3xl:auto-rows-[220px] @3xl:grid-cols-4">
            {shots.slice(0, 12).map((shot, i) => (
              <span
                key={shot.id}
                className={cn(
                  "relative overflow-hidden bg-raised",
                  i % 6 === 0 && "col-span-2 row-span-2",
                  i % 6 === 3 && "col-span-2",
                )}
              >
                <Image
                  src={shot.url}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  unoptimized
                  className="object-cover transition-transform duration-500 ease-neon hover:scale-[1.03]"
                />
              </span>
            ))}
          </div>
        </section>
      )}

      {(posts.length > 0 || d.related.length > 0 || title.entry?.notes) && (
        <section className={cn(SECTION, "pb-20")}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12 @4xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @4xl:gap-6">
            <div className="flex flex-col gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} large />
              ))}
              {title.entry?.notes && (
                <div className={cn(CARD, "p-6 @lg:p-8")}>
                  <span className="label">{p.notes}</span>
                  <p className="mt-3 whitespace-pre-line text-ink-2">{title.entry.notes}</p>
                </div>
              )}
            </div>
            {d.related.length > 0 && (
              <div>
                <h2 className="mb-6 font-display text-[28px] font-medium">{p.related}</h2>
                <div className="flex flex-col gap-3">
                  {d.related.map((r, i) => {
                    const linked = index.get(r.title_id);
                    const name = linked?.name ?? r.name ?? "";
                    const note = [r.note, linked?.entry ? "" : p.notOnShelf]
                      .filter(Boolean)
                      .join(" · ");
                    const inner = (
                      <>
                        {linked ? (
                          <Thumb title={linked} className="h-[68px] w-[52px]" />
                        ) : (
                          <span className="grid h-[68px] w-[52px] shrink-0 place-items-center rounded-sm bg-raised font-display text-sm font-medium text-muted">
                            {initials(name)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <b className="block font-medium">{name}</b>
                          {note && <span className="text-muted">{note}</span>}
                        </span>
                      </>
                    );
                    const box =
                      "flex items-center gap-4 rounded-md border border-line bg-surface p-3";
                    return linked ? (
                      <a key={i} href={titleHref(linked)} className={cn(box, LIFT)}>
                        {inner}
                      </a>
                    ) : (
                      <div key={i} className={box}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </article>
  );
}
