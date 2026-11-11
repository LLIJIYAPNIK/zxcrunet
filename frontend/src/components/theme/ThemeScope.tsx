import type { CSSProperties, ComponentProps } from "react";

import { derivePalette, paletteCssVars } from "@/lib/theme/palette";

type ThemeScopeProps = ComponentProps<"div"> & {
  accent: string;
  second?: string;
};

/** Applies a derived neon palette to everything inside via CSS custom properties. */
export function ThemeScope({ accent, second, style, ...rest }: ThemeScopeProps) {
  const vars = paletteCssVars(derivePalette(accent, second)) as CSSProperties;
  return <div style={{ ...vars, ...style }} {...rest} />;
}
