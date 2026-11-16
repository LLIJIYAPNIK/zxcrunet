"use client";

import { useState } from "react";

import { MediaField, PatternField, RangeField } from "@/blocks/fields";
import {
  DEFAULT_APPEARANCE,
  SECTION_BACKGROUNDS,
  SECTION_DIVIDERS,
  SECTION_SPACES,
  type Appearance,
} from "@/blocks/schemas";
import { ColorPicker } from "@/components/theme/ColorPicker";
import { Segmented } from "@/components/ui/Segmented";
import { ru } from "@/i18n/ru";
import { cn } from "@/lib/cn";
import { BODY_FONT_IDS, FONT_IDS, type BodyFontId, type FontId } from "@/lib/theme/fonts";

import { FontPicker } from "./FontPicker";

const t = ru.builder.section;
const d = ru.builder.design;

/** A swatch that opens the colour wheel in place. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-3 rounded-md border border-line-2 bg-surface px-3 text-left hover:border-accent"
      >
        <span
          aria-hidden="true"
          className="size-6 rounded-full border border-line-2"
          style={{ background: value }}
        />
        <span className="flex-1 text-[15px] text-ink-2">{label}</span>
        <span className="font-mono text-[13px] text-muted">{value}</span>
      </button>
      {open && <ColorPicker label={label} value={value} onChange={onChange} />}
    </div>
  );
}

function Choice<V extends string>({
  label,
  value,
  options,
  names,
  onChange,
}: {
  label: string;
  value: V;
  options: readonly V[];
  names: Record<V, string>;
  onChange: (value: V) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-2">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            onClick={() => onChange(option)}
            className={cn(
              "h-10 rounded-btn border px-3.5 text-[14px] transition-colors",
              option === value
                ? "border-accent bg-raised text-ink"
                : "border-line-2 text-ink-2 hover:border-line-2 hover:text-ink",
            )}
          >
            {names[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Section appearance of the selected block. `null` means «as the style draws it»; the
 * first change creates the object, «Сбросить» removes it.
 */
export function AppearanceEditor({
  value,
  onChange,
  siteFonts,
}: {
  value: Appearance | null | undefined;
  onChange: (value: Appearance | null) => void;
  /** The site's fonts, shown as the «inherit» option. */
  siteFonts: { heading: FontId; body: BodyFontId };
}) {
  const a = { ...DEFAULT_APPEARANCE, ...value };
  const set = (patch: Partial<Appearance>) => onChange({ ...a, ...patch });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[17px] font-medium">{t.title}</h3>
        <p className="text-sm text-muted">{t.lead}</p>
      </div>

      <Choice
        label={t.background}
        value={a.background}
        options={SECTION_BACKGROUNDS}
        names={t.backgrounds}
        onChange={(background) => set({ background })}
      />

      {(a.background === "color" || a.background === "gradient") && (
        <ColorField label={t.color} value={a.color} onChange={(color) => set({ color })} />
      )}
      {a.background === "gradient" && (
        <>
          <ColorField label={t.color2} value={a.color2} onChange={(color2) => set({ color2 })} />
          <RangeField
            label={t.angle}
            value={a.angle}
            min={0}
            max={360}
            step={15}
            unit="°"
            onChange={(angle) => set({ angle })}
          />
        </>
      )}
      {a.background === "image" && (
        <>
          <MediaField
            label={t.image}
            purpose="image"
            value={a.image}
            onChange={(image) => set({ image })}
          />
          <RangeField label={t.dim} value={a.dim} max={90} onChange={(dim) => set({ dim })} />
        </>
      )}
      {a.background === "pattern" && (
        <PatternField
          label={t.pattern}
          value={a.pattern}
          onChange={(pattern) => set({ pattern })}
        />
      )}

      <Segmented
        label={t.space}
        value={a.space}
        onChange={(space) => set({ space })}
        options={SECTION_SPACES.map((s) => ({ value: s, label: t.spaces[s] }))}
      />
      <Choice
        label={t.divider}
        value={a.divider}
        options={SECTION_DIVIDERS}
        names={t.dividers}
        onChange={(divider) => set({ divider })}
      />

      <FontPicker
        label={d.headingFont}
        value={a.heading_font as FontId | ""}
        fonts={FONT_IDS}
        inheritLabel={d.siteFont}
        inheritFont={siteFonts.heading}
        onChange={(heading_font) => set({ heading_font })}
      />
      <FontPicker
        label={d.bodyFont}
        value={a.body_font as BodyFontId | ""}
        fonts={BODY_FONT_IDS}
        inheritLabel={d.siteFont}
        inheritFont={siteFonts.body}
        onChange={(body_font) => set({ body_font })}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-start text-sm text-muted hover:text-ink"
        >
          {t.reset}
        </button>
      )}
    </div>
  );
}
