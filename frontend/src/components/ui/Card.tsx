import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const base =
  "rounded-lg border border-line bg-surface p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] sm:p-8";

/** A linked card lifts 2px on hover. */
const lift =
  "transition-[transform,border-color,box-shadow] duration-200 ease-neon hover:-translate-y-0.5 " +
  "hover:border-line-2 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_12px_32px_rgba(0,0,0,.35)]";

type CardProps = ComponentProps<"div"> & { lift?: boolean };

export function Card({ lift: withLift = false, className, ...rest }: CardProps) {
  return <div className={cn(base, withLift && lift, className)} {...rest} />;
}

export function CardLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={cn(base, lift, "block", className)} {...rest} />;
}
