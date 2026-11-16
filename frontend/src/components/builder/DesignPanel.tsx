"use client";

import type { CSSProperties } from "react";

import { Pattern } from "@/components/public/Pattern";
import {
  PalettePicker,
  choiceFromColors,
  type PaletteChoice,
} from "@/components/theme/PalettePicker";
import { ThemeScope } from "@/components/theme/ThemeScope";
import { ru } from "@/i18n/ru";
import type { Schemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { BODY_FONT_IDS, FONTS, FONT_IDS, fontVar } from "@/lib/theme/fonts";
import { SITE_FONT_VARIABLES } from "@/lib/theme/site-fonts";
import { SITE_STYLES, STYLES, lookFonts, type SiteStyle } from "@/lib/theme/styles";

import { FontPicker } from "./FontPicker";

const t = ru.builder.design;

export type Theme = Schemas["ThemeOut"];

const FACES = {
  "--ff-onest": "var(--font-onest)",
  "--ff-jetbrains": "var(--font-jetbrains-mono)",
} as CSSProperties;

/** A small card drawn in the style itself: ground, corners, heading face, label. */
function StyleCard({
  style,
  theme,
  selected,
  onSelect,
}: {
  style: SiteStyle;
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
}) {
  const info = t.styles[style];
  const heading = STYLES[style].heading;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group flex flex-col overflow-hidden rounded-md border text-left transition-[border-color,transform] duration-200 ease-neon hover:-translate-y-px",
        selected ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-line-2",
      )}
    >
      <ThemeScope
        accent={theme.accent}
        second={theme.second ?? undefined}
        look={style}
        data-style={style}
        className="relative flex h-24 flex-col justify-end gap-1 bg-bg p-3 text-ink"
      >
        <Pattern pattern={style === "gothic" ? "arches" : "rings"} />
        <span className="label relative">zxcrunet</span>
        <span
          className="relative text-[22px] leading-none font-semibold text-ink"
          style={{ fontFamily: `${fontVar(heading)}, serif` }}
        >
          {t.sample}
        </span>
      </ThemeScope>
      <span className="flex flex-col gap-1 border-t border-line bg-surface p-3">
        <b className="font-medium">{info.name}</b>
        <span className="text-[13px] leading-snug text-muted">{info.text}</span>
      </span>
    </button>
  );
}

/**
 * Site-wide look: style, palette and fonts. Changes apply to the preview immediately;
 * the builder saves them (debounced) through `PATCH /api/sites/{id}`.
 */
export function DesignPanel({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (patch: Partial<Theme>) => void;
}) {
  const style = theme.style ?? "neon";
  const defaults = STYLES[style];
  const fonts = lookFonts(theme);
  const palette = choiceFromColors(theme.accent, theme.second);

  function setPalette(choice: PaletteChoice) {
    onChange({ accent: choice.accent, second: choice.second ?? null });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-7 rounded-lg border border-line bg-surface p-5",
        SITE_FONT_VARIABLES,
      )}
      style={FACES}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-medium">{t.title}</h2>
        <p className="text-sm text-ink-2">{t.lead}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">{t.style}</legend>
        <div role="radiogroup" aria-label={t.style} className="grid grid-cols-2 gap-3">
          {SITE_STYLES.map((s) => (
            <StyleCard
              key={s}
              style={s}
              theme={theme}
              selected={s === style}
              onSelect={() => onChange({ style: s })}
            />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-ink-2">{t.palette}</span>
        <PalettePicker value={palette} onChange={setPalette} look={style} />
      </div>

      <FontPicker
        label={t.headingFont}
        value={theme.heading_font ?? ""}
        fonts={FONT_IDS}
        inheritLabel={t.styleFont.replace("{font}", FONTS[defaults.heading].name)}
        inheritFont={defaults.heading}
        onChange={(heading_font) => onChange({ heading_font })}
      />
      <FontPicker
        label={t.bodyFont}
        value={theme.body_font ?? ""}
        fonts={BODY_FONT_IDS}
        inheritLabel={t.styleFont.replace("{font}", FONTS[defaults.body].name)}
        inheritFont={defaults.body}
        hint={t.bodyHint}
        onChange={(body_font) => onChange({ body_font })}
      />
      <p
        className="rounded-md border border-line bg-bg p-4 text-[15px] text-ink-2"
        style={{ fontFamily: `${fontVar(fonts.body)}, system-ui, sans-serif` }}
      >
        <span
          className="mb-1 block text-[22px] text-ink"
          style={{ fontFamily: `${fontVar(fonts.heading)}, system-ui, sans-serif` }}
        >
          {t.sample}
        </span>
        {t.sampleText}
      </p>
    </div>
  );
}
