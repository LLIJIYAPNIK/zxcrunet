/**
 * Fonts a card can use (mirror of backend `sites.domain.site.FONTS`). Pure data, no CSS:
 * the faces themselves are loaded by `site-fonts.ts`, only where a card is rendered.
 */
import type { Schemas } from "@/lib/api/client";

export type FontId = Exclude<Schemas["ThemeOut"]["heading_font"], "">;
export type BodyFontId = Exclude<Schemas["ThemeOut"]["body_font"], "">;

export type FontGroup = "sans" | "serif" | "gothic" | "grunge" | "hand" | "mono" | "pixel";

export type FontInfo = {
  name: string;
  group: FontGroup;
  /** Readable at body size: offered for text as well as headings. */
  body: boolean;
};

export const FONTS = {
  onest: { name: "Onest", group: "sans", body: true },
  inter: { name: "Inter", group: "sans", body: true },
  manrope: { name: "Manrope", group: "sans", body: true },
  golos: { name: "Golos", group: "sans", body: true },
  unbounded: { name: "Unbounded", group: "sans", body: false },
  russo: { name: "Russo One", group: "sans", body: false },
  "dela-gothic": { name: "Dela Gothic One", group: "sans", body: false },
  tektur: { name: "Tektur", group: "sans", body: false },
  cormorant: { name: "Cormorant Garamond", group: "serif", body: true },
  playfair: { name: "Playfair Display", group: "serif", body: false },
  "eb-garamond": { name: "EB Garamond", group: "serif", body: true },
  lora: { name: "Lora", group: "serif", body: true },
  "pt-serif": { name: "PT Serif", group: "serif", body: true },
  "old-standard": { name: "Old Standard", group: "serif", body: true },
  yeseva: { name: "Yeseva One", group: "serif", body: false },
  prata: { name: "Prata", group: "serif", body: false },
  ruslan: { name: "Ruslan Display", group: "gothic", body: false },
  monomakh: { name: "Monomakh", group: "gothic", body: false },
  "rubik-glitch": { name: "Rubik Glitch", group: "grunge", body: false },
  "rubik-wet-paint": { name: "Rubik Wet Paint", group: "grunge", body: false },
  caveat: { name: "Caveat", group: "hand", body: false },
  marck: { name: "Marck Script", group: "hand", body: false },
  jetbrains: { name: "JetBrains Mono", group: "mono", body: true },
  "ibm-plex-mono": { name: "IBM Plex Mono", group: "mono", body: true },
  "press-start": { name: "Press Start 2P", group: "pixel", body: false },
  pixelify: { name: "Pixelify Sans", group: "pixel", body: false },
  poiret: { name: "Poiret One", group: "serif", body: false },
} as const satisfies Record<FontId, FontInfo>;

export const FONT_IDS = Object.keys(FONTS) as FontId[];
export const BODY_FONT_IDS = FONT_IDS.filter((id) => FONTS[id].body) as BodyFontId[];

export const FONT_GROUPS: readonly FontGroup[] = [
  "gothic",
  "serif",
  "sans",
  "grunge",
  "hand",
  "mono",
  "pixel",
];

/** The CSS variable a face is exposed as (set by `site-fonts.ts`). */
export function fontVar(id: FontId): string {
  return `var(--ff-${id})`;
}
