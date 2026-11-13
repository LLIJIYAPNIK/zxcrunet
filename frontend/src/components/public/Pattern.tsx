/**
 * Decorative background patterns for the profile card and the personal cover.
 * Pure (no hooks): rendered on the server and in the editor preview alike.
 * Each pattern is an SVG used as a CSS mask, so it is painted with the palette colours.
 */
import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import type { PatternId } from "@/lib/theme/patterns";

export { PATTERNS, type PatternId } from "@/lib/theme/patterns";

type Tile = { svg: string; size: string; repeat?: boolean; position?: string };

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`,
  )}")`;

const STROKE = "fill='none' stroke='#000'";

const TILES: Record<Exclude<PatternId, "glow" | "none">, Tile> = {
  rings: {
    svg: svg(
      300,
      300,
      [70, 110, 150, 190].map((r) => `<circle cx='240' cy='60' r='${r}' ${STROKE}/>`).join(""),
    ),
    size: "300px 300px",
    repeat: false,
    position: "top right",
  },
  dots: { svg: svg(18, 18, "<circle cx='3' cy='3' r='1.6'/>"), size: "18px 18px" },
  grid: { svg: svg(28, 28, `<path d='M28 .5H.5V28' ${STROKE}/>`), size: "28px 28px" },
  diagonal: {
    svg: svg(14, 14, `<path d='M-3.5 3.5l7-7M0 14L14 0M10.5 17.5l7-7' ${STROKE}/>`),
    size: "14px 14px",
  },
  plus: {
    svg: svg(28, 28, `<path d='M14 9v10M9 14h10' ${STROKE} stroke-width='1.4'/>`),
    size: "28px 28px",
  },
  waves: {
    svg: svg(48, 16, `<path d='M0 8q12-9 24 0t24 0' ${STROKE} stroke-width='1.2'/>`),
    size: "48px 16px",
  },
  circuit: {
    svg: svg(
      80,
      80,
      `<path d='M0 20h24l10 10v20h46M40 0v10M56 80V58l10-10h14M12 80V64l8-8' ${STROKE}/>` +
        "<circle cx='40' cy='12' r='2.5'/><circle cx='20' cy='56' r='2.5'/>" +
        "<circle cx='66' cy='48' r='2.5'/>",
    ),
    size: "80px 80px",
  },
  topo: {
    svg: svg(
      400,
      300,
      [0, 1, 2, 3, 4, 5, 6]
        .map((i) => {
          const rx = 40 + i * 34;
          const ry = 24 + i * 22;
          return `<ellipse cx='${300 - i * 6}' cy='${80 + i * 4}' rx='${rx}' ry='${ry}' transform='rotate(${-18 + i * 3} 300 80)' ${STROKE}/>`;
        })
        .join(""),
    ),
    size: "cover",
    repeat: false,
    position: "top right",
  },
};

/** Where the pattern stays visible: a corner of a card, or the top of a wide cover. */
export type PatternFade = "corner" | "top";

const FADES: Record<PatternFade, string> = {
  corner: "radial-gradient(130% 130% at 100% 0%, #000 0%, rgba(0,0,0,.35) 45%, transparent 75%)",
  top: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,.55) 55%, transparent 100%)",
};

const GLOW =
  "radial-gradient(90% 140% at 20% 100%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%)," +
  "radial-gradient(60% 120% at 90% 0%, color-mix(in srgb, var(--second) 16%, transparent), transparent 60%)";

type PatternProps = {
  pattern: PatternId;
  fade?: PatternFade;
  className?: string;
};

export function Pattern({ pattern, fade = "corner", className }: PatternProps) {
  if (pattern === "none") return null;
  const base = cn("pointer-events-none absolute inset-0", className);
  if (pattern === "glow") {
    return <span aria-hidden="true" className={base} style={{ backgroundImage: GLOW }} />;
  }
  const tile = TILES[pattern] as Tile | undefined;
  if (!tile) return null;
  const paint: CSSProperties = {
    background: "color-mix(in srgb, var(--accent) 55%, var(--line-2))",
    opacity: 0.55,
    maskImage: tile.svg,
    WebkitMaskImage: tile.svg,
    maskSize: tile.size,
    WebkitMaskSize: tile.size,
    maskRepeat: tile.repeat === false ? "no-repeat" : "repeat",
    WebkitMaskRepeat: tile.repeat === false ? "no-repeat" : "repeat",
    maskPosition: tile.position ?? "0 0",
    WebkitMaskPosition: tile.position ?? "0 0",
  };
  return (
    <span
      aria-hidden="true"
      data-pattern={pattern}
      className={base}
      style={{ maskImage: FADES[fade], WebkitMaskImage: FADES[fade] }}
    >
      <span className="absolute inset-0" style={paint} />
    </span>
  );
}
