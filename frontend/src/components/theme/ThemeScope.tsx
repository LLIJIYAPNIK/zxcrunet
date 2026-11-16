import type { CSSProperties, ComponentProps } from "react";

import { derivePalette, paletteCssVars, type PaletteStyle } from "@/lib/theme/palette";

type ThemeScopeProps = ComponentProps<"div"> & {
  accent: string;
  second?: string;
  /** Card style: changes how dark the grounds are and how much the accent glows. */
  look?: PaletteStyle;
};

/** Applies a derived neon palette to everything inside via CSS custom properties. */
export function ThemeScope({ accent, second, look, style, ...rest }: ThemeScopeProps) {
  const vars = paletteCssVars(derivePalette(accent, second, look)) as CSSProperties;
  return <div style={{ ...vars, ...style }} {...rest} />;
}
