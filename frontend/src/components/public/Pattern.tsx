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
  lattice: {
    svg: svg(24, 32, `<path d='M12 0L24 16L12 32L0 16Z' ${STROKE}/>`),
    size: "24px 32px",
  },
  arches: {
    svg: svg(40, 64, `<path d='M3 64V30Q3 10 20 3Q37 10 37 30V64M20 3V0' ${STROKE}/>`),
    size: "40px 64px",
  },
  crosses: {
    svg: svg(32, 32, `<path d='M16 8v16M11 13h10' ${STROKE} stroke-width='1.4'/>`),
    size: "32px 32px",
  },
  stars: {
    svg: svg(
      120,
      120,
      "<path d='M18 17L19.25 20.75L23 22L19.25 23.25L18 27L16.75 23.25L13 22L16.75 20.75Z'/><path d='M74 9L74.75 11.25L77 12L74.75 12.75L74 15L73.25 12.75L71 12L73.25 11.25Z'/><path d='M102 54L103 57L106 58L103 59L102 62L101 59L98 58L101 57Z'/><path d='M40 75L40.75 77.25L43 78L40.75 78.75L40 81L39.25 78.75L37 78L39.25 77.25Z'/><path d='M86 95L87.25 98.75L91 100L87.25 101.25L86 105L84.75 101.25L81 100L84.75 98.75Z'/><path d='M12 105L12.75 107.25L15 108L12.75 108.75L12 111L11.25 108.75L9 108L11.25 107.25Z'/><path d='M60 42L60.5 43.5L62 44L60.5 44.5L60 46L59.5 44.5L58 44L59.5 43.5Z'/>",
    ),
    size: "120px 120px",
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
export type PatternFade = "corner" | "top" | "full";

const FADES: Record<PatternFade, string> = {
  corner: "radial-gradient(130% 130% at 100% 0%, #000 0%, rgba(0,0,0,.35) 45%, transparent 75%)",
  top: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,.55) 55%, transparent 100%)",
  full: "linear-gradient(#000, #000)",
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
