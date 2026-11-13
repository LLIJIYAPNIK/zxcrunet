import Image from "next/image";

import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";

import { Pattern, type PatternId } from "./Pattern";

export type ProfileCardProps = {
  name: string;
  role?: string;
  address: string;
  chips?: readonly string[];
  avatarUrl?: string | null;
  /** Background decoration; the reference card has rings in the corner. */
  pattern?: PatternId;
  className?: string;
};

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** The business-card visual from the reference hero (`.vcard`). */
export function ProfileCard({
  name,
  role,
  address,
  chips = [],
  avatarUrl,
  pattern = "rings",
  className,
}: ProfileCardProps) {
  return (
    <div
      role="img"
      aria-label={[name, role, address].filter(Boolean).join(", ")}
      className={cn(
        "relative flex aspect-[1.6/1] min-h-[220px] w-full max-w-[560px] flex-col justify-between overflow-hidden rounded-[24px] border border-line-2 bg-surface p-6 @lg:p-9",
        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent),0_30px_80px_-30px_var(--glow)]",
        className,
      )}
    >
      <Pattern pattern={pattern} />
      <div className="relative flex items-center gap-4 @lg:gap-5">
        {avatarUrl ? (
          <span className="size-16 shrink-0 rounded-full border-2 border-accent p-1 shadow-[0_0_28px_var(--glow)] @lg:size-[88px]">
            <Image
              src={avatarUrl}
              alt=""
              width={176}
              height={176}
              unoptimized
              className="size-full rounded-full object-cover"
            />
          </span>
        ) : (
          <Avatar initials={initialsOf(name)} size={88} glow className="@max-lg:size-16!" />
        )}
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight font-medium tracking-[-0.02em] @lg:text-[26px]">
            {name}
          </p>
          {role && <p className="mt-1 text-[15px] text-muted">{role}</p>}
        </div>
      </div>
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <span className="truncate font-mono text-[15px] text-accent">{address}</span>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip, i) => (
              <Chip key={`${chip}-${i}`} variant={i === 0 ? "accent" : "default"}>
                {chip}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
