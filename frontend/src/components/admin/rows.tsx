import Link from "next/link";
import type { ReactNode } from "react";

import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

/** A list of rows that stays readable on a phone: title line, then a line of details. */
export function Rows({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      {children}
    </ul>
  );
}

export function Row({
  href,
  title,
  meta,
  side,
  children,
}: {
  href?: string;
  title: ReactNode;
  meta?: ReactNode;
  side?: ReactNode;
  children?: ReactNode;
}) {
  const head = (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="min-w-0 truncate font-medium text-ink">{title}</span>
      {meta && (
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">{meta}</span>
      )}
    </span>
  );
  return (
    <li className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-0 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {href ? (
          <Link href={href} className="min-w-0 flex-1 hover:[&>span>span:first-child]:text-accent">
            {head}
          </Link>
        ) : (
          <div className="min-w-0 flex-1">{head}</div>
        )}
        {side && <span className="flex flex-wrap items-center gap-2">{side}</span>}
      </div>
      {children}
    </li>
  );
}

type Tone = "ok" | "warn" | "bad" | "muted";

const tones: Record<Tone, string> = {
  ok: "",
  warn: "border-[color-mix(in_srgb,var(--second)_55%,transparent)] text-second",
  bad: "border-[#ff6b6b]/50 text-[#ffb3b3]",
  muted: "",
};

/** Status chip: the label always says the state; the colour only repeats it. */
export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Chip
      variant={tone === "ok" ? "accent" : tone === "muted" ? "dash" : "default"}
      className={cn(tones[tone])}
    >
      {children}
    </Chip>
  );
}

const s = ru.sites.status;
const d = ru.sites.domains.status;

export function siteTone(status: string): Tone {
  return status === "published" ? "ok" : status === "suspended" ? "bad" : "muted";
}

export function siteStatusText(status: string): string {
  return status in s ? s[status as keyof typeof s] : status;
}

export function domainTone(status: string): Tone {
  if (status === "active") return "ok";
  if (status === "verified" || status === "pending") return "warn";
  return "bad";
}

export function domainStatusText(status: string): string {
  return status in d ? d[status as keyof typeof d] : status;
}
