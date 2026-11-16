import type { CSSProperties, ReactNode } from "react";

import { ThemeScope } from "@/components/theme/ThemeScope";
import type { Schemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { fontVar } from "@/lib/theme/fonts";
import { SITE_FONT_VARIABLES } from "@/lib/theme/site-fonts";
import { lookFonts } from "@/lib/theme/styles";

type Theme = Schemas["ThemeOut"];

/**
 * Root of a card: palette, style (`data-style`, CSS in globals.css) and fonts.
 * Headings use `--site-display`, text `--site-sans`; sections may override both.
 */
export function SiteScope({
  theme,
  className,
  children,
}: {
  theme: Theme;
  className?: string;
  children: ReactNode;
}) {
  const style = theme.style ?? "neon";
  const fonts = lookFonts(theme);
  return (
    <ThemeScope
      accent={theme.accent}
      second={theme.second ?? undefined}
      look={style}
      data-site=""
      data-style={style}
      className={cn(SITE_FONT_VARIABLES, className)}
      style={
        {
          "--site-display": fontVar(fonts.heading),
          "--site-sans": fontVar(fonts.body),
        } as CSSProperties
      }
    >
      {children}
    </ThemeScope>
  );
}
