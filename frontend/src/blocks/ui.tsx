/** Shared pieces of block renders (server-safe, no hooks). */
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import type { CatalogIndex } from "@/lib/catalog/catalog";

import type { AnyBlock, Link, MediaRef, SettingsOf } from "./schemas";

/** Equal side gutters inside the site container: 16 / 40 / 80 px. */
export const CWRAP = "mx-auto w-full max-w-[1440px] px-4 @3xl:px-10 @7xl:px-20";

export const external = (url: string) => /^https?:\/\//i.test(url);

export const externalProps = (url: string) =>
  external(url) ? { target: "_blank", rel: "noopener noreferrer" } : {};

export function SmartLink({ link, className }: { link: Link; className?: string }) {
  return (
    <a href={link.url} className={className} {...externalProps(link.url)}>
      {link.label}
    </a>
  );
}

export function SectionHead({
  label,
  title,
  aside,
  className,
}: {
  label?: string;
  title?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  if (!label && !title && !aside) return null;
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 @3xl:mb-12 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-6",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        {label && <span className="label">{label}</span>}
        {title && <h2 className="font-display text-ch2 font-medium">{title}</h2>}
      </div>
      {aside}
    </div>
  );
}

export const accentLink =
  "w-max bg-[linear-gradient(currentColor,currentColor)] bg-[length:0_1px] bg-[position:0_100%] bg-no-repeat pb-0.5 font-medium text-accent transition-[background-size] duration-300 ease-neon hover:bg-[length:100%_1px]";

/** Card surface used across blocks. */
export const CARD =
  "rounded-lg border border-line bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,.05)]";

export const LIFT =
  "transition-[transform,border-color,box-shadow] duration-200 ease-neon hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_12px_32px_rgba(0,0,0,.35)]";

/** An uploaded picture that fills its (positioned) parent. */
export function Cover({
  media,
  alt = "",
  className,
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: {
  media: MediaRef;
  alt?: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <Image
      src={media.url}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized
      className={cn("object-cover", className)}
    />
  );
}

export type RenderContext = {
  /** `anna.zxc.ru.net` */
  address: string;
  siteTitle: string;
  /** The owner's shelves and posts (personal sites); empty for business ones. */
  catalog: CatalogIndex;
  /** Editor preview: empty catalog blocks show a hint instead of vanishing. */
  preview?: boolean;
};

export type BlockProps<T extends AnyBlock["type"]> = {
  id: string;
  settings: SettingsOf<T>;
  ctx: RenderContext;
};
