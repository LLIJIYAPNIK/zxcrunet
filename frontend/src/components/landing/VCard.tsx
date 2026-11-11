import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { SERVICE_DOMAIN } from "@/config/site";
import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

/** The business card preview from the reference «Профиль · бизнес» hero. */
export function VCard({ className }: { className?: string }) {
  const d = ru.demo;
  return (
    <div
      className={cn(
        "relative flex aspect-[1.6/1] min-h-[220px] flex-col justify-between overflow-hidden rounded-[24px] border border-line-2 bg-surface p-6 sm:p-9",
        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent),0_30px_80px_-30px_var(--glow)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-[220px] rounded-full border border-line after:absolute after:inset-9 after:rounded-full after:border after:border-line"
      />
      <div className="flex items-center gap-4 sm:gap-5">
        <Avatar initials={d.initials} size={88} glow className="max-sm:!size-16" />
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight font-medium tracking-[-0.02em] sm:text-[26px]">
            {d.name}
          </p>
          <p className="mt-1 text-[15px] text-muted">{d.role}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {d.chips.map((chip, i) => (
          <Chip key={chip} variant={i < 2 ? "accent" : "default"}>
            {chip}
          </Chip>
        ))}
      </div>
      <div className="flex items-end justify-between gap-4">
        <span className="truncate font-mono text-[15px] text-accent">
          {d.slug}.{SERVICE_DOMAIN}
        </span>
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          {d.online}
        </span>
      </div>
    </div>
  );
}
