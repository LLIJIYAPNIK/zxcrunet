/** Catalog visuals shared by shelf blocks, title pages and the guest shelf browser. */
import Image from "next/image";

import { Badge } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { initials, statusText, titleHref, yearsText, type Title } from "@/lib/catalog/catalog";
import { ru } from "@/i18n/ru";

/** Cover image, or a typographic placeholder with the name (fills a positioned parent). */
export function CoverArt({
  title,
  className,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  caption,
  bare = false,
}: {
  title: Pick<Title, "name" | "cover" | "part_label" | "genres">;
  className?: string;
  sizes?: string;
  /** Small line above the name on the placeholder. */
  caption?: string;
  /** Placeholder without text, when the name is printed next to it anyway. */
  bare?: boolean;
}) {
  if (title.cover) {
    return (
      <Image
        src={title.cover.url}
        alt=""
        fill
        sizes={sizes}
        unoptimized
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-0 flex flex-col justify-end bg-[radial-gradient(120%_80%_at_100%_0%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_60%)] p-5",
        className,
      )}
    >
      {!bare && (
        <>
          <small className="mb-2 font-mono text-[13px] text-muted">
            {caption ?? (title.part_label || title.genres[0] || "")}
          </small>
          <span className="font-display text-[26px] leading-[1.1] font-medium tracking-[-0.02em] text-ink-2">
            {title.name}
          </span>
        </>
      )}
    </span>
  );
}

/** Square thumbnail: cover or initials. */
export function Thumb({
  title,
  className,
}: {
  title: Pick<Title, "name" | "cover">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-sm bg-raised font-display text-[13px] font-medium text-muted",
        className,
      )}
    >
      {title.cover ? (
        <Image
          src={title.cover.url}
          alt=""
          fill
          sizes="64px"
          unoptimized
          className="object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(title.name)}</span>
      )}
    </span>
  );
}

export function StatusBadge({ title, className }: { title: Title; className?: string }) {
  const status = title.entry?.status;
  if (!status) return null;
  return (
    <Badge
      tone={status === "active" ? "accent" : status === "done" ? "done" : "default"}
      className={className}
    >
      {statusText(title.kind, status)}
    </Badge>
  );
}

/** Cover card of a work: «Сетка» and «Серии» views. */
export function TitleCard({ title, href = titleHref(title) }: { title: Title; href?: string }) {
  const meta = [yearsText(title), title.genres[0]].filter(Boolean).join(" · ");
  return (
    <a
      href={href}
      className="group/t flex min-w-0 flex-col gap-1.5 transition-transform duration-200 ease-neon hover:-translate-y-0.5"
    >
      <span className="relative mb-3 aspect-[3/4] overflow-hidden rounded-lg border border-line bg-surface">
        <CoverArt title={title} />
        <StatusBadge title={title} className="absolute top-4 left-4 z-[1]" />
      </span>
      <b className="font-display text-[17px] leading-snug font-medium">{title.name}</b>
      {meta && <span className="label">{meta}</span>}
    </a>
  );
}

/** 10 cells, the first `value` lit: the criteria rating. */
export function RatingCells({ name, value }: { name: string; value: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-x-4 gap-y-2 @3xl:grid-cols-[180px_minmax(0,1fr)_72px]">
      <span className="col-start-1 row-start-1 text-ink-2">{name}</span>
      <span
        className="col-span-2 col-start-1 row-start-2 grid grid-cols-10 gap-1 @3xl:col-span-1 @3xl:col-start-2 @3xl:row-start-1"
        aria-hidden="true"
      >
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={cn("h-6 rounded-[4px]", i < value ? "bg-accent" : "bg-line")} />
        ))}
      </span>
      <span className="col-start-2 row-start-1 text-right font-mono whitespace-nowrap text-ink @3xl:col-start-3">
        {ru.catalog.page.ofTen.replace("{n}", String(value))}
      </span>
    </div>
  );
}

/** Season segments S1…Sn: watched, current, ahead. */
export function Segments({
  total,
  done,
  current,
}: {
  total: number;
  done: number;
  current: boolean;
}) {
  return (
    <span className="flex gap-1.5">
      {Array.from({ length: Math.min(total, 20) }, (_, i) => (
        <span
          key={i}
          className={cn(
            "grid h-9 min-w-0 flex-1 place-items-center rounded-sm border font-mono text-[13px] font-medium",
            i < done
              ? "border-accent bg-accent text-accent-ink"
              : i === done && current
                ? "border-accent text-accent"
                : "border-line-2 text-muted",
          )}
        >
          {ru.catalog.shelf.seasons.replace("{n}", String(i + 1))}
        </span>
      ))}
    </span>
  );
}
