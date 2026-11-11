import { describe, expect, it } from "vitest";

import { contrast, hexToRgb, isHex, normalizeHex, rgbToHsl } from "./color";
import {
  MIN_ACCENT_CONTRAST,
  PRESETS,
  derivePalette,
  ensureContrast,
  paletteCssVars,
  safeHue,
} from "./palette";

describe("color helpers", () => {
  it("normalises short and uppercase hex", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("5AB9FC")).toBe("#5ab9fc");
  });

  it("rejects invalid hex", () => {
    expect(isHex("#12345")).toBe(false);
    expect(() => normalizeHex("blue")).toThrow();
  });

  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBe(1);
  });
});

describe("safeHue", () => {
  it.each([
    [200, 200],
    [270, 255],
    [299, 255],
    [300, 345],
    [330, 345],
    [331, 331],
  ])("maps %i to %i", (input, expected) => {
    expect(safeHue(input)).toBe(expected);
  });
});

describe("derivePalette", () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))(
    "preset %s keeps its neon and passes contrast",
    (_, preset) => {
      const palette = derivePalette(preset.accent, preset.second);

      expect(palette.accent).toBe(preset.accent);
      expect(contrast(palette.accent, palette.bg)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
      expect(contrast(palette.accentInk, palette.accent)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("builds dark tinted surfaces in increasing lightness", () => {
    const p = derivePalette("#5ab9fc");
    const l = (hex: string) => rgbToHsl(hexToRgb(hex)).l;

    expect(l(p.bg)).toBeLessThan(l(p.surface));
    expect(l(p.surface)).toBeLessThan(l(p.raised));
    expect(l(p.raised)).toBeLessThan(15);
  });

  it("never tints the background violet", () => {
    const p = derivePalette("#9b30ff");
    const hue = rgbToHsl(hexToRgb(p.raised)).h;

    expect(hue < 270 || hue > 330).toBe(true);
  });

  it("lightens a too-dark custom neon until it is readable", () => {
    const p = derivePalette("#1a2a6c");

    expect(p.accent).not.toBe("#1a2a6c");
    expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
  });

  it("derives a second neon when none is given", () => {
    const p = derivePalette("#5ab9fc");

    expect(isHex(p.second)).toBe(true);
    expect(p.second).not.toBe(p.accent);
  });

  it("exposes CSS variables", () => {
    const vars = paletteCssVars(derivePalette("#ff4f8b"));

    expect(vars["--accent"]).toBe("#ff4f8b");
    expect(vars["--glow"]).toMatch(/^rgba\(255, 79, 139, 0\.38\)$/);
  });
});

describe("ensureContrast", () => {
  it("leaves a readable colour untouched", () => {
    expect(ensureContrast("#5ab9fc", "#000000", 4.5)).toBe("#5ab9fc");
  });
});
