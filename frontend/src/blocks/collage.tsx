/**
 * «Коллаж»: tiles placed on a 12-column grid (4 on phones), overlapping by layers.
 * Positions travel as CSS variables; globals.css switches the grid at the card's
 * 48rem container width, so the editor preview at 390px shows the phone layout.
 */
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import { LoopVideo } from "@/components/public/LoopVideo";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { CELL_PX, phonePlaces } from "@/lib/collage";
import { PROVIDER_NAMES, embedSrc } from "@/lib/embed";

import type { Place, SettingsOf, Tile } from "./schemas";
import { CWRAP, SectionHead, externalProps, type BlockProps as Props } from "./ui";

const GAP = { none: "0px", s: "12px", m: "24px" } as const;

const TEXT_STYLE: Record<Tile["text_style"], string> = {
  heading: "font-display text-ch2 font-medium text-ink",
  body: "text-clead text-ink-2",
  quote: "border-l-2 border-accent pl-4 font-display text-[1.375rem] leading-snug text-ink italic",
  label: "label",
};

const ALIGN: Record<Tile["align"], string> = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

const FILL: Record<Tile["fill"], string> = {
  none: "",
  surface: "bg-surface border border-line p-5 @3xl:p-7",
  accent:
    "p-5 @3xl:p-7 border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))]",
};

function vars(desktop: Place, phone: Place, layer: number): CSSProperties {
  return {
    "--dx": desktop.x + 1,
    "--dy": desktop.y + 1,
    "--dw": desktop.w,
    "--dh": desktop.h,
    "--px": phone.x + 1,
    "--py": phone.y + 1,
    "--pw": phone.w,
    "--ph": phone.h,
    "--layer": layer,
  } as CSSProperties;
}

function TileBody({ tile }: { tile: Tile }): ReactNode {
  const fit = tile.fit === "contain" ? "object-contain" : "object-cover";
  switch (tile.kind) {
    case "image":
      return tile.media ? (
        <Image
          src={tile.media.url}
          alt={tile.alt}
          fill
          unoptimized
          sizes="(min-width: 1024px) 50vw, 100vw"
          className={cn(
            fit,
            "transition-transform duration-500 ease-neon group-hover/tile:scale-[1.02]",
          )}
        />
      ) : null;
    case "video":
      return tile.media ? (
        <LoopVideo
          src={tile.media.url}
          label={tile.alt}
          className={cn("absolute inset-0 size-full", fit)}
        />
      ) : null;
    case "embed":
      return tile.embed ? (
        <iframe
          src={embedSrc(tile.embed)}
          title={tile.alt || PROVIDER_NAMES[tile.embed.provider]}
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : null;
    case "text":
      return tile.text ? (
        <p className={cn("whitespace-pre-line", TEXT_STYLE[tile.text_style])}>{tile.text}</p>
      ) : null;
    case "button":
      return tile.link?.label ? (
        <ButtonLink href={tile.link.url} arrow>
          {tile.link.label}
        </ButtonLink>
      ) : null;
  }
}

export function CollageTile({
  tile,
  desktop,
  phone,
}: {
  tile: Tile;
  desktop: Place;
  phone: Place;
}) {
  const media = tile.kind === "image" || tile.kind === "video" || tile.kind === "embed";
  const body = <TileBody tile={tile} />;
  const className = cn(
    "group/tile relative min-w-0",
    media
      ? cn("overflow-hidden bg-raised", tile.rounded && "rounded-lg")
      : cn(
          "flex flex-col justify-center",
          ALIGN[tile.align],
          FILL[tile.fill],
          tile.rounded && tile.fill !== "none" && "rounded-lg",
        ),
  );
  const style = vars(desktop, phone, tile.layer);
  if (media && tile.link && tile.kind !== "embed") {
    return (
      <a
        href={tile.link.url}
        data-tile={tile.kind}
        aria-label={tile.link.label || tile.alt || undefined}
        className={className}
        style={style}
        {...externalProps(tile.link.url)}
      >
        {body}
      </a>
    );
  }
  return (
    <div data-tile={tile.kind} className={className} style={style}>
      {body}
    </div>
  );
}

/** The grid itself (also drawn by the hero «Коллаж» preview and tests). */
export function CollageGrid({ settings: s }: { settings: SettingsOf<"collage"> }) {
  const phone = phonePlaces(s.tiles, s.phone, s.cell);
  return (
    <div
      data-collage=""
      style={
        {
          "--cell-d": `${CELL_PX[s.cell].desktop}px`,
          "--cell-p": `${CELL_PX[s.cell].phone}px`,
          "--gap": GAP[s.gap],
        } as CSSProperties
      }
    >
      {s.tiles.map((tile) => (
        <CollageTile key={tile.id} tile={tile} desktop={tile.desktop} phone={phone.get(tile.id)!} />
      ))}
    </div>
  );
}

function Collage({ id, settings: s }: Props<"collage">) {
  if (!s.tiles.length) return null;
  return (
    <section id={id} className="scroll-mt-20 py-14 @3xl:py-18">
      {(s.label || s.title) && (
        <div className={CWRAP}>
          <SectionHead label={s.label} title={s.title || undefined} />
        </div>
      )}
      <div className={s.bleed ? "px-0" : CWRAP}>
        <CollageGrid settings={s} />
      </div>
    </section>
  );
}

export const COLLAGE_RENDERERS = { collage: Collage };
