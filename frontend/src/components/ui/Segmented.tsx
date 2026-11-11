"use client";

import { useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

export type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the whole group. */
  label: string;
  className?: string;
};

/** Two-to-four exclusive options in one pill, e.g. «Бизнес | Личное». */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid rounded-md border border-line bg-surface p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-10 rounded-[9px] px-3 text-[15px] font-medium transition-colors duration-200",
            opt.value === value ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type TabsProps<T extends string> = SegmentedProps<T> & {
  /** Prefix for tab/panel ids: tab `${idBase}-tab-${value}`, panel `${idBase}-panel-${value}`. */
  idBase: string;
};

/** WAI-ARIA tabs (arrow keys move between tabs). Panels are rendered by the caller. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
  idBase,
  className,
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.findIndex((o) => o.value === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex w-max max-w-full gap-1 overflow-x-auto rounded-md border border-line p-1",
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${opt.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${opt.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-10 shrink-0 rounded-[9px] px-[18px] text-[15px] font-medium transition-colors duration-200",
              selected ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
