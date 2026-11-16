/**
 * Section appearance: background, room, divider and fonts around any block.
 * Pure (no hooks): rendered on the server and in the editor preview alike.
 */
import type { CSSProperties, ReactNode } from "react";

import { Pattern } from "@/components/public/Pattern";
import { cn } from "@/lib/cn";
import { contrast, hexToRgb, rgbToHex } from "@/lib/theme/color";
import { fontVar, type BodyFontId, type FontId } from "@/lib/theme/fonts";

import { DEFAULT_APPEARANCE, type Appearance } from "./schemas";
import { CWRAP } from "./ui";

const SPACE: Record<Appearance["space"], string> = {
  none: "",
  s: "py-6 @3xl:py-8",
  m: "py-12 @3xl:py-16",
  l: "py-20 @3xl:py-28",
};

/** Text colours for a light background: the palette's ink is made for dark grounds. */
const DARK_INK = {
  "--ink": "#14110f",
  "--ink-2": "rgba(20, 17, 15, 0.8)",
  "--muted": "rgba(20, 17, 15, 0.62)",
  "--line": "rgba(20, 17, 15, 0.12)",
  "--line-2": "rgba(20, 17, 15, 0.22)",
} as CSSProperties;

function isLight(hex: string): boolean {
  return contrast(hex, "#000000") > contrast(hex, "#ffffff");
}

function midpoint(a: string, b: string): string {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex([0, 1, 2].map((i) => Math.round((x[i] + y[i]) / 2)) as [number, number, number]);
}

const ACCENT_GLOW =
  "radial-gradient(70% 90% at 15% 0%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%)," +
  "radial-gradient(60% 80% at 100% 100%, color-mix(in srgb, var(--second) 14%, transparent), transparent 70%)";

function backgroundStyle(a: Appearance): CSSProperties {
  switch (a.background) {
    case "surface":
      return { backgroundColor: "var(--surface)" };
    case "accent":
      return { backgroundImage: ACCENT_GLOW };
    case "color":
      return { backgroundColor: a.color, ...(isLight(a.color) ? DARK_INK : {}) };
    case "gradient":
      return {
        backgroundImage: `linear-gradient(${a.angle}deg, ${a.color}, ${a.color2})`,
        ...(isLight(midpoint(a.color, a.color2)) ? DARK_INK : {}),
      };
    case "image": {
      if (!a.image) return {};
      const shade = `rgba(0, 0, 0, ${a.dim / 100})`;
      return {
        // The URL is a validated `/media/…` path: no quotes or parentheses can reach CSS.
        backgroundImage: `linear-gradient(${shade}, ${shade}), url(${a.image.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    default:
      return {};
  }
}

function fontStyle(heading: FontId | "", body: BodyFontId | ""): CSSProperties {
  const style: Record<string, string> = {};
  if (heading) style["--site-display"] = fontVar(heading);
  if (body) {
    style["--site-sans"] = fontVar(body);
    style.fontFamily = "var(--site-sans), system-ui, sans-serif";
  }
  return style as CSSProperties;
}

/** A thin rule with a four-pointed star: the gothic section break. */
export function Ornament({ className }: { className?: string }) {
  const rule = "h-px flex-1 from-transparent to-[color-mix(in_srgb,var(--accent)_55%,transparent)]";
  return (
    <div
      aria-hidden="true"
      data-ornament=""
      className={cn(CWRAP, "flex items-center gap-4 text-accent", className)}
    >
      <span className={cn(rule, "bg-linear-to-r")} />
      <svg viewBox="0 0 48 16" className="h-4 w-12 shrink-0" fill="currentColor">
        <circle cx="4" cy="8" r="1.5" />
        <path d="M24 0l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
        <circle cx="44" cy="8" r="1.5" />
      </svg>
      <span className={cn(rule, "bg-linear-to-l")} />
    </div>
  );
}

/** Wraps a rendered block when it has its own appearance; otherwise returns it as is. */
export function SectionFrame({
  appearance,
  children,
}: {
  appearance?: Appearance | null;
  children: ReactNode;
}) {
  if (!appearance) return <>{children}</>;
  const a = { ...DEFAULT_APPEARANCE, ...appearance };
  const style = {
    ...backgroundStyle(a),
    ...fontStyle(a.heading_font, a.body_font),
  };
  return (
    <div
      data-section=""
      data-background={a.background}
      className={cn(
        "relative isolate text-ink",
        SPACE[a.space],
        a.divider === "line" && "border-t border-line",
      )}
      style={style}
    >
      {a.background === "pattern" && <Pattern pattern={a.pattern} fade="full" className="-z-10" />}
      {a.divider === "ornament" && <Ornament className="pt-8 @3xl:pt-12" />}
      {children}
    </div>
  );
}
