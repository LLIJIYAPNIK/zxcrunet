"use client";

import { cn } from "@/lib/cn";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; required because the switch has no visible text of its own. */
  label: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group/sw grid h-11 w-12 shrink-0 place-items-center disabled:opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "relative h-[26px] w-11 rounded-full transition-colors duration-200",
          checked ? "bg-accent" : "bg-line-2",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] left-[3px] size-5 rounded-full transition-[transform,background-color] duration-200 ease-neon",
            checked ? "translate-x-[18px] bg-accent-ink" : "bg-muted",
          )}
        />
      </span>
    </button>
  );
}
