/**
 * Card styles: a look on top of the palette (fonts, corners, textures, dividers).
 * The CSS lives in globals.css under `[data-style="…"]`; this file holds what code needs.
 */
import type { Schemas } from "@/lib/api/client";

import type { BodyFontId, FontId } from "./fonts";

export type SiteStyle = Schemas["ThemeOut"]["style"];

export type StyleInfo = {
  /** Fonts used when the owner has not picked their own. */
  heading: FontId;
  body: BodyFontId;
  /** Palettes offered first for this style (ids from `PRESETS`). */
  presets: readonly string[];
};

export const STYLES = {
  neon: {
    heading: "onest",
    body: "onest",
    presets: ["sky", "cyan", "rose", "lime", "violet", "toxic"],
  },
  gothic: {
    heading: "cormorant",
    body: "lora",
    presets: ["blood", "bone", "amethyst", "absinthe", "candle"],
  },
} as const satisfies Record<SiteStyle, StyleInfo>;

export const SITE_STYLES = Object.keys(STYLES) as SiteStyle[];

export type Look = {
  style?: SiteStyle;
  heading_font?: FontId | "";
  body_font?: BodyFontId | "";
};

/** The fonts a card actually uses: the owner's choice, otherwise the style's. */
export function lookFonts(look: Look): { heading: FontId; body: BodyFontId } {
  const style = STYLES[look.style ?? "neon"];
  return { heading: look.heading_font || style.heading, body: look.body_font || style.body };
}
