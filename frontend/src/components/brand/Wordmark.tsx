import { BRAND } from "@/config/site";
import { cn } from "@/lib/cn";

/** The arc mark from the reference design: a neon horizon. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[9px] bg-raised shadow-[inset_0_0_0_1px_var(--line-2)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path
          d="M5 17a7 7 0 0 1 14 0"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

type WordmarkProps = {
  className?: string;
};

/** The zxcrunet label: arc mark plus lowercase wordmark. */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark />
      <span className="font-display text-xl leading-none font-medium tracking-[-0.02em]">
        {BRAND}
      </span>
    </span>
  );
}
