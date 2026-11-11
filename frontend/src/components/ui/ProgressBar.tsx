import { cn } from "@/lib/cn";

type Tone = "accent" | "second" | "ink";

const tones: Record<Tone, string> = {
  accent: "bg-accent",
  second: "bg-second",
  ink: "bg-ink-2",
};

type ProgressBarProps = {
  /** 0..1 */
  value: number;
  label: string;
  tone?: Tone;
  className?: string;
};

export function ProgressBar({ value, label, tone = "accent", className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1.5 overflow-hidden rounded-full bg-line", className)}
    >
      <span
        className={cn("block h-full rounded-full", tones[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
