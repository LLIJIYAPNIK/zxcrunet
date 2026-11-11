"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { isHex, normalizeHex } from "@/lib/theme/color";
import { PRESETS, type PalettePreset } from "@/lib/theme/palette";
import { ru } from "@/i18n/ru";

export type PaletteChoice = {
  /** Selected preset id, or null for a custom colour. */
  presetId: string | null;
  accent: string;
  second?: string;
};

export function choiceFromPreset(preset: PalettePreset): PaletteChoice {
  return { presetId: preset.id, accent: preset.accent, second: preset.second };
}

type PalettePickerProps = {
  value: PaletteChoice;
  onChange: (choice: PaletteChoice) => void;
  /** Compact: dots only, no names, no custom input. */
  compact?: boolean;
  className?: string;
};

export function PalettePicker({ value, onChange, compact = false, className }: PalettePickerProps) {
  const t = ru.palette;
  const [draft, setDraft] = useState(value.accent);
  const [prevAccent, setPrevAccent] = useState(value.accent);
  if (value.accent !== prevAccent) {
    // Keep the hex field in sync when a preset is picked.
    setPrevAccent(value.accent);
    setDraft(value.accent);
  }
  const draftInvalid = draft.trim() !== "" && !isHex(draft);

  function commitDraft(next: string) {
    setDraft(next);
    if (isHex(next)) onChange({ presetId: null, accent: normalizeHex(next) });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="radiogroup"
        aria-label={t.presetsLabel}
        className={cn("grid gap-2", compact ? "grid-cols-6" : "grid-cols-3 sm:grid-cols-6")}
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
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">{t.customLabel}</span>
          <span
            className={cn(
              "flex h-12 items-center gap-3 rounded-md border bg-surface px-3.5 transition-colors focus-within:border-accent",
              draftInvalid ? "border-[#ff6b6b]" : "border-line-2",
            )}
          >
            <span
              aria-hidden="true"
              className="size-6 rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]"
              style={{ background: isHex(draft) ? normalizeHex(draft) : "transparent" }}
            />
            <input
              value={draft}
              onChange={(e) => commitDraft(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              maxLength={7}
              aria-invalid={draftInvalid}
              placeholder="#5ab9fc"
              className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </span>
          {draftInvalid && <span className="text-[13px] text-[#ff6b6b]">{t.invalidHex}</span>}
        </label>
      )}
    </div>
  );
}
