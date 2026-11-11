import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

type AvatarProps = {
  /** Initials shown when there is no photo, e.g. «АК». */
  initials: string;
  /** Diameter in px. */
  size?: number;
  /** Neon glow around the ring — the product's one glow. */
  glow?: boolean;
  /** Muted ring instead of the accent one. */
  muted?: boolean;
  className?: string;
};

export function Avatar({
  initials,
  size = 72,
  glow = false,
  muted = false,
  className,
}: AvatarProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    padding: size >= 120 ? 5 : size >= 60 ? 4 : 3,
    fontSize: Math.round(size * 0.29),
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border-2 transition-shadow duration-300",
        muted ? "border-line-2" : "border-accent",
        glow && !muted && "shadow-[0_0_28px_var(--glow)]",
        className,
      )}
      style={style}
    >
      <span
        className={cn(
          "grid size-full place-items-center rounded-full bg-raised font-display leading-none font-medium tracking-[-0.02em]",
          muted ? "text-ink" : "text-accent",
        )}
      >
        {initials}
      </span>
    </span>
  );
}
