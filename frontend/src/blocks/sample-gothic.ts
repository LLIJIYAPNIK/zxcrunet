/**
 * The business sample dressed in the gothic style: section backgrounds, dividers and
 * per-section fonts. Used by /ui/sample/gothic and the demo seed.
 */
import { SAMPLE_BUSINESS_BLOCKS } from "./sample";
import { DEFAULT_APPEARANCE, type Appearance, type AnyBlock } from "./schemas";

const look = (patch: Partial<Appearance>): Appearance => ({ ...DEFAULT_APPEARANCE, ...patch });

const APPEARANCE: Partial<Record<AnyBlock["type"], Appearance>> = {
  hero: look({ background: "pattern", pattern: "arches", heading_font: "ruslan" }),
  facts: look({ background: "surface", space: "s" }),
  experience: look({ divider: "ornament" }),
  projects: look({ background: "accent", divider: "ornament" }),
  stack: look({ background: "gradient", color: "#140c0e", color2: "#050304", angle: 160 }),
  contacts: look({
    background: "pattern",
    pattern: "lattice",
    divider: "ornament",
    heading_font: "monomakh",
  }),
};

export const SAMPLE_GOTHIC_BLOCKS: AnyBlock[] = SAMPLE_BUSINESS_BLOCKS.map((block) => ({
  ...block,
  appearance: APPEARANCE[block.type] ?? null,
}));

export const SAMPLE_GOTHIC_THEME = {
  accent: "#f0283f",
  second: "#d4af37",
  style: "gothic" as const,
  heading_font: "" as const,
  body_font: "" as const,
};
