import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

/** Label + control + hint/error, wired with ids for screen readers. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children({ id, describedBy: note ? noteId : undefined, invalid: Boolean(error) })}
      {note && (
        <span id={noteId} className={cn("text-[13px]", error ? "text-[#ff6b6b]" : "text-muted")}>
          {note}
        </span>
      )}
    </div>
  );
}

const box =
  "flex h-12 items-center gap-2.5 rounded-md border border-line-2 bg-surface px-3.5 transition-colors " +
  "focus-within:border-accent has-[[aria-invalid=true]]:border-[#ff6b6b]";

type InputProps = ComponentProps<"input"> & {
  /** Fixed text before/after the value, e.g. `.zxc.ru.net`. Rendered in mono. */
  prefix?: string;
  suffix?: string;
};

export function Input({ prefix, suffix, className, ...rest }: InputProps) {
  return (
    <div className={cn(box, "min-w-0", className)}>
      {prefix && <span className="font-mono text-sm text-muted">{prefix}</span>}
      <input
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
        {...rest}
      />
      {suffix && <span className="font-mono text-sm text-muted">{suffix}</span>}
    </div>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "resize-none rounded-md border border-line-2 bg-surface px-3.5 py-3 text-base leading-normal text-ink outline-none",
        "transition-colors placeholder:text-muted focus:border-accent aria-[invalid=true]:border-[#ff6b6b]",
        className,
      )}
      {...rest}
    />
  );
}
