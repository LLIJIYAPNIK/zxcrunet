"use client";

import { useId, useState, type CSSProperties } from "react";

import { Icon } from "@/components/ui/Icon";
import { ru } from "@/i18n/ru";
import { cn } from "@/lib/cn";
import { FONTS, FONT_GROUPS, fontVar, type FontId } from "@/lib/theme/fonts";
import { SITE_FONT_VARIABLES } from "@/lib/theme/site-fonts";

const t = ru.builder.design;

/** Declares every `--ff-*` face on the picker so each option is drawn in its own font. */
const FACES = { "--ff-onest": "var(--font-onest)", "--ff-jetbrains": "var(--font-jetbrains-mono)" };

function face(id: FontId | null): CSSProperties | undefined {
  return id ? { fontFamily: `${fontVar(id)}, system-ui, sans-serif` } : undefined;
}

/**
 * A font list that opens in place (no popover: comfortable on a phone). Every option shows
 * the face itself; the empty value means «inherit» and is named by `inheritLabel`.
 */
export function FontPicker<F extends FontId>({
  label,
  value,
  onChange,
  fonts,
  inheritLabel,
  inheritFont,
  hint,
}: {
  label: string;
  value: F | "";
  onChange: (value: F | "") => void;
  fonts: readonly F[];
  inheritLabel: string;
  /** What «inherit» looks like right now (the style's or the site's font). */
  inheritFont: FontId;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const current: FontId = value || inheritFont;

  function pick(next: F | "") {
    onChange(next);
    setOpen(false);
  }

  const option = (id: F | "", name: string) => {
    const selected = value === id;
    const shown: FontId = id || inheritFont;
    return (
      <button
        key={id || "inherit"}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={name}
        onClick={() => pick(id)}
        className={cn(
          "flex w-full items-baseline justify-between gap-3 rounded-sm px-3 py-2.5 text-left transition-colors",
          selected ? "bg-raised text-ink" : "text-ink-2 hover:bg-surface hover:text-ink",
        )}
      >
        <span className="min-w-0 truncate text-[17px]" style={face(shown)}>
          {name}
        </span>
        <span className="shrink-0 text-[13px] text-muted" style={face(shown)}>
          {t.sample}
        </span>
      </button>
    );
  };

  return (
    <div className={cn("flex flex-col gap-2", SITE_FONT_VARIABLES)} style={FACES as CSSProperties}>
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center justify-between gap-3 rounded-md border border-line-2 bg-surface px-3 text-left transition-colors hover:border-accent"
      >
        <span className="min-w-0 truncate text-[17px]" style={face(current)}>
          {value ? FONTS[value].name : inheritLabel}
        </span>
        <Icon name={open ? "up" : "down"} size={16} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div
          id={listId}
          role="radiogroup"
          aria-label={label}
          className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-md border border-line-2 bg-bg p-2"
        >
          {option("", inheritLabel)}
          {FONT_GROUPS.map((group) => {
            const list = fonts.filter((id) => FONTS[id].group === group);
            if (!list.length) return null;
            return (
              <div key={group} className="flex flex-col gap-0.5">
                <span className="label px-3 pb-1">{t.fontGroups[group]}</span>
                {list.map((id) => option(id, FONTS[id].name))}
              </div>
            );
          })}
        </div>
      )}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
