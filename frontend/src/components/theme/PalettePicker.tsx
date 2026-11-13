"use client";

import { useState } from "react";

import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { PRESETS, derivePalette, type PalettePreset } from "@/lib/theme/palette";
import { ru } from "@/i18n/ru";

import { ColorPicker } from "./ColorPicker";

export type PaletteChoice = {
  /** Selected preset id, or null for a custom colour. */
  presetId: string | null;
  accent: string;
  /** Second accent; undefined means «derive from the main one». */
  second?: string;
};

export function choiceFromPreset(preset: PalettePreset): PaletteChoice {
  return { presetId: preset.id, accent: preset.accent, second: preset.second };
}

/** The preset that matches the colours exactly, if any. */
export function choiceFromColors(accent: string, second?: string | null): PaletteChoice {
  const preset = PRESETS.find((p) => p.accent === accent && p.second === (second ?? undefined));
  return preset
    ? choiceFromPreset(preset)
    : { presetId: null, accent, second: second ?? undefined };
}

type PalettePickerProps = {
  value: PaletteChoice;
  onChange: (choice: PaletteChoice) => void;
  /** Compact: dots only, no names, no custom colour. */
  compact?: boolean;
  className?: string;
};

type Target = "accent" | "second";

export function PalettePicker({ value, onChange, compact = false, className }: PalettePickerProps) {
  const t = ru.palette;
  const [target, setTarget] = useState<Target>("accent");
  const derived = derivePalette(value.accent, value.second);
  const autoSecond = value.second === undefined;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div
        role="radiogroup"
        aria-label={t.presetsLabel}
        className={cn("grid gap-2", compact ? "grid-cols-8" : "grid-cols-3 sm:grid-cols-5")}
      >
        {PRESETS.map((preset) => {
          const selected = value.presetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={preset.name}
              onClick={() => onChange(choiceFromPreset(preset))}
              className={cn(
                "flex flex-col items-center gap-2 rounded-md border px-1 transition-[border-color,background-color,transform] duration-200 ease-neon",
                "hover:-translate-y-px hover:border-line-2 active:scale-[.97]",
                compact ? "py-2.5" : "pt-3.5 pb-3",
                selected ? "bg-raised" : "border-line",
              )}
              style={selected ? { borderColor: preset.accent } : undefined}
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="size-5 rounded-full" style={{ background: preset.accent }} />
                {!compact && (
                  <span className="size-3 rounded-full" style={{ background: preset.second }} />
                )}
              </span>
              {!compact && (
                <span className="text-center text-[13px] leading-tight text-ink-2">
                  {preset.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!compact && (
        <div className="flex flex-col gap-5 rounded-lg border border-line p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t.customTitle}</span>
            <span className="text-sm text-muted">{t.customHint}</span>
          </div>
          <Segmented
            label={t.customTitle}
            value={target}
            onChange={setTarget}
            options={[
              { value: "accent", label: t.mainColor },
              { value: "second", label: t.secondColor },
            ]}
          />

          {target === "accent" ? (
            <ColorPicker
              label={t.mainColor}
              value={value.accent}
              onChange={(accent) => onChange({ presetId: null, accent, second: value.second })}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] text-ink-2">{t.autoSecond}</span>
                <Switch
                  label={t.autoSecond}
                  checked={autoSecond}
                  onChange={(on) =>
                    onChange({
                      presetId: null,
                      accent: value.accent,
                      second: on ? undefined : derived.second,
                    })
                  }
                />
              </div>
              {!autoSecond && value.second && (
                <ColorPicker
                  label={t.secondColor}
                  value={value.second}
                  onChange={(second) => onChange({ presetId: null, accent: value.accent, second })}
                />
              )}
            </div>
          )}

          {(derived.accent !== value.accent ||
            (value.second && derived.second !== value.second)) && (
            <p className="text-[13px] text-muted">
              {t.contrastNote}{" "}
              <span className="font-mono text-ink-2">
                {[
                  derived.accent !== value.accent && derived.accent,
                  value.second && derived.second !== value.second && derived.second,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
