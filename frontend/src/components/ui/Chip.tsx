import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type ChipVariant = "default" | "accent" | "fill" | "dash";

const variants: Record<ChipVariant, string> = {
  default: "border-line-2 text-ink-2",
  accent: "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] text-accent",
  fill: "border-accent bg-accent text-accent-ink",
  dash: "border-dashed border-line-2 text-muted",
};

type ChipProps = ComponentProps<"span"> & { variant?: ChipVariant };

export function Chip({ variant = "default", className, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

type BadgeTone = "default" | "accent" | "done";

const badgeTones: Record<BadgeTone, string> = {
  default: "border-line-2 bg-[rgba(5,7,11,.72)] text-ink-2",
  accent: "border-accent bg-accent text-accent-ink",
  done: "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-[rgba(5,7,11,.72)] text-accent",
};

type BadgeProps = ComponentProps<"span"> & { tone?: BadgeTone };

/** Status badge on covers: «Играю», «Пройдено». */
export function Badge({ tone = "default", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
      {...rest}
    />
  );
}
