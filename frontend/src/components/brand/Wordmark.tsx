import { BRAND } from "@/config/site";

type WordmarkProps = {
  className?: string;
};

/** The zxcrunet label: neon mark plus lowercase wordmark. */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[9px] bg-raised shadow-[inset_0_0_0_1px_var(--line-2)]"
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="none">
          <path
            d="M5 5.5h10L5 14.5h10"
            stroke="var(--accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-xl leading-none font-medium tracking-[-0.02em]">
        {BRAND}
      </span>
    </span>
  );
}
