import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const base =
  "group/btn inline-flex shrink-0 items-center justify-center gap-2.5 rounded-btn font-medium leading-none whitespace-nowrap " +
  "transition-[transform,background-color,border-color,color] duration-200 ease-neon " +
  "hover:-translate-y-px active:translate-y-0 active:scale-[.98] " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-[color-mix(in_srgb,var(--accent)_86%,#fff)]",
  secondary: "border border-line-2 text-ink hover:border-ink",
  ghost: "text-ink-2 hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-6 text-base",
  sm: "h-9 px-4 text-sm",
};

type StyleProps = {
  variant?: Variant;
  size?: Size;
  /** Arrow after the label that steps right on hover. */
  arrow?: boolean;
  children: ReactNode;
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}): string {
  return cn(base, variants[variant], sizes[size], className);
}

function Content({ arrow, children }: Pick<StyleProps, "arrow" | "children">) {
  return (
    <>
      {children}
      {arrow && (
        <Icon
          name="arrow"
          size={18}
          className="transition-transform duration-200 ease-neon group-hover/btn:translate-x-[3px]"
        />
      )}
    </>
  );
}

type ButtonProps = StyleProps & Omit<ComponentProps<"button">, "children">;

export function Button({
  variant,
  size,
  arrow,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...rest}>
      <Content arrow={arrow}>{children}</Content>
    </button>
  );
}

type ButtonLinkProps = StyleProps & Omit<ComponentProps<typeof Link>, "children">;

export function ButtonLink({
  variant,
  size,
  arrow,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...rest}>
      <Content arrow={arrow}>{children}</Content>
    </Link>
  );
}
