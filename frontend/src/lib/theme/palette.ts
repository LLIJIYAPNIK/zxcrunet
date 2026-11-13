/**
 * Profile palette: the user picks one neon (accent), everything else is derived from it.
 * Rules come from design/Неоновые визитки — редизайн.html (`derive`, `safeHue`).
 */
import { contrast, hexToRgb, hslToHex, normalizeHex, rgbToHsl } from "./color";

export type PalettePreset = {
  id: string;
  name: string;
  accent: string;
  second: string;
};

export const PRESETS: readonly PalettePreset[] = [
  { id: "sky", name: "Небесный", accent: "#5ab9fc", second: "#ffb545" },
  { id: "cyan", name: "Кибер-циан", accent: "#00e5ff", second: "#ff4f8b" },
  { id: "rose", name: "Неон-роза", accent: "#ff4f8b", second: "#29f0ff" },
  { id: "lime", name: "Кислотный лайм", accent: "#b6ff2e", second: "#ff4f8b" },
  { id: "orange", name: "Лазерный оранж", accent: "#ff7a1a", second: "#2ee6ff" },
  { id: "mint", name: "Мятный", accent: "#3ddc7a", second: "#ffb545" },
  { id: "violet", name: "Ультрафиолет", accent: "#a98bff", second: "#ffe14d" },
  { id: "gold", name: "Золото", accent: "#ffc93d", second: "#5ab9fc" },
  { id: "scarlet", name: "Алый", accent: "#ff5a5a", second: "#2ee6ff" },
  { id: "teal", name: "Бирюза", accent: "#2dd4bf", second: "#ff7a1a" },
  { id: "sakura", name: "Сакура", accent: "#ffa3c7", second: "#8ef5c6" },
  { id: "ice", name: "Лёд", accent: "#a8e6ff", second: "#ff8fb1" },
  { id: "coral", name: "Коралл", accent: "#ff8a65", second: "#4dd0e1" },
  { id: "toxic", name: "Токсик", accent: "#39ff14", second: "#ff3df0" },
  { id: "mono", name: "Монохром", accent: "#e9edf3", second: "#5ab9fc" },
];

export const DEFAULT_PRESET = PRESETS[0];

/** Text colours used on top of the accent. */
const INK_DARK = "#0a0d14";
const INK_LIGHT = "#ffffff";

/** Minimum contrast of accent (used for text and links) against the background. */
export const MIN_ACCENT_CONTRAST = 4.5;

export type Palette = {
  accent: string;
  accentInk: string;
  second: string;
  bg: string;
  surface: string;
  raised: string;
  glow: string;
};

/** The violet rule: background tints never go violet; hues 270–330 snap to 255 or 345. */
export function safeHue(hue: number): number {
  if (hue >= 270 && hue <= 330) return hue < 300 ? 255 : 345;
  return hue;
}

/** Raises the colour's lightness until it reaches `min` contrast against `background`. */
export function ensureContrast(color: string, background: string, min: number): string {
  const hsl = rgbToHsl(hexToRgb(color));
  let current = normalizeHex(color);
  while (contrast(current, background) < min && hsl.l < 95) {
    hsl.l = Math.min(95, hsl.l + 2);
    current = hslToHex(hsl);
  }
  return current;
}

function pickInk(accent: string): string {
  return contrast(accent, INK_DARK) >= contrast(accent, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

export function derivePalette(accentInput: string, secondInput?: string): Palette {
  const raw = normalizeHex(accentInput);
  const { h } = rgbToHsl(hexToRgb(raw));
  const tint = safeHue(Math.round(h));

  const bg = hslToHex({ h: tint, s: 28, l: 4.6 });
  const surface = hslToHex({ h: tint, s: 24, l: 8.4 });
  const raised = hslToHex({ h: tint, s: 20, l: 12 });

  const accent = ensureContrast(raw, bg, MIN_ACCENT_CONTRAST);
  const secondRaw = secondInput
    ? normalizeHex(secondInput)
    : hslToHex({ h: safeHue(Math.round((h + 180) % 360)), s: 100, l: 63 });
  const second = ensureContrast(secondRaw, bg, MIN_ACCENT_CONTRAST);

  const [r, g, b] = hexToRgb(accent);
  return {
    accent,
    accentInk: pickInk(accent),
    second,
    bg,
    surface,
    raised,
    glow: `rgba(${r}, ${g}, ${b}, 0.38)`,
  };
}

export function presetPalette(preset: PalettePreset): Palette {
  return derivePalette(preset.accent, preset.second);
}

/** CSS custom properties for a palette, to put on any element as inline `style`. */
export function paletteCssVars(p: Palette): Record<`--${string}`, string> {
  return {
    "--accent": p.accent,
    "--accent-ink": p.accentInk,
    "--second": p.second,
    "--bg": p.bg,
    "--surface": p.surface,
    "--raised": p.raised,
    "--glow": p.glow,
  };
}
