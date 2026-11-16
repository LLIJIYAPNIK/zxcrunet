"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { isVideo, type MediaRef } from "@/blocks/schemas";
import { Icon } from "@/components/ui/Icon";
import { ru } from "@/i18n/ru";
import { cn } from "@/lib/cn";

import { LoopVideo } from "./LoopVideo";

const t = ru.publicSite.carousel;

export type CarouselItem = {
  media: MediaRef;
  alt: string;
  link: { label: string; url: string } | null;
};

/** Frame heights: smaller on phones, follow the card container. */
export const CAROUSEL_HEIGHTS = {
  s: "h-44 @3xl:h-56",
  m: "h-64 @3xl:h-[22rem]",
  l: "h-80 @3xl:h-[30rem]",
} as const;

export type CarouselHeight = keyof typeof CAROUSEL_HEIGHTS;

function Media({ item, sizes }: { item: CarouselItem; sizes: string }) {
  return isVideo(item.media) ? (
    <LoopVideo src={item.media.url} label={item.alt} className="absolute inset-0 size-full" />
  ) : (
    <Image
      src={item.media.url}
      alt={item.alt}
      fill
      sizes={sizes}
      unoptimized
      draggable={false}
      className="object-cover transition-transform duration-500 ease-neon group-hover/slide:scale-[1.03]"
    />
  );
}

function Frame({
  item,
  className,
  style,
  sizes,
  hidden,
}: {
  item: CarouselItem;
  className: string;
  style?: CSSProperties;
  sizes: string;
  hidden?: boolean;
}) {
  const body: ReactNode = <Media item={item} sizes={sizes} />;
  const frame = cn(
    "group/slide relative block shrink-0 overflow-hidden rounded-lg border border-line bg-raised",
    className,
  );
  if (item.link) {
    const outside = /^https?:\/\//i.test(item.link.url);
    return (
      <a
        href={item.link.url}
        className={frame}
        style={style}
        aria-label={item.link.label || item.alt || undefined}
        tabIndex={hidden ? -1 : undefined}
        {...(outside ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  return (
    <span className={frame} style={style}>
      {body}
    </span>
  );
}

/** Width of a strip frame from the picture's own proportions (4:3 when unknown). */
function ratio(media: MediaRef): string {
  return media.width && media.height ? `${media.width} / ${media.height}` : "4 / 3";
}

/**
 * A running strip: the items twice in a row, shifted by half the track forever. Visitors who
 * asked for less motion get a still strip they can scroll.
 */
export function Marquee({
  items,
  speed,
  direction,
  height,
  pauseOnHover,
  label,
}: {
  items: readonly CarouselItem[];
  speed: number;
  direction: "left" | "right";
  height: CarouselHeight;
  pauseOnHover: boolean;
  label: string;
}) {
  return (
    <div
      role="region"
      aria-roledescription={t.marquee}
      aria-label={label}
      data-marquee=""
      data-direction={direction}
      data-pause-hover={pauseOnHover ? "" : undefined}
      className="marquee overflow-hidden"
      style={{ "--marquee-duration": `${speed}s` } as CSSProperties}
    >
      <div className="marquee-track flex w-max">
        {/* Two equal halves (each ends with its own gap): shifting by 50% loops seamlessly. */}
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1 || undefined} className="flex gap-4 pr-4">
            {items.map((item, i) => (
              <Frame
                key={i}
                item={item}
                hidden={copy === 1}
                sizes="480px"
                className={CAROUSEL_HEIGHTS[height]}
                style={{ aspectRatio: ratio(item.media) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Slides one after another, round and round: swipe, arrows, dots, or on their own.
 * Autoplay stops on hover (if asked), on focus, off screen and for reduced motion.
 */
export function Slides({
  items,
  autoplay,
  interval,
  height,
  pauseOnHover,
  label,
}: {
  items: readonly CarouselItem[];
  autoplay: boolean;
  interval: number;
  height: CarouselHeight;
  pauseOnHover: boolean;
  label: string;
}) {
  const track = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(true);
  const count = items.length;

  const go = useCallback(
    (next: number) => {
      const list = track.current;
      if (!list || !count) return;
      const target = ((next % count) + count) % count;
      const slide = list.children[target] as HTMLElement | undefined;
      if (!slide) return;
      list.scrollTo({
        left: slide.offsetLeft - (list.clientWidth - slide.clientWidth) / 2,
        behavior: "smooth",
      });
      setIndex(target);
    },
    [count],
  );

  // The slide nearest the centre is the current one (after a swipe too).
  useEffect(() => {
    const list = track.current;
    if (!list) return;
    const onScroll = () => {
      const centre = list.scrollLeft + list.clientWidth / 2;
      let best = 0;
      let distance = Infinity;
      Array.from(list.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - centre);
        if (d < distance) [best, distance] = [i, d];
      });
      setIndex(best);
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setStill(media.matches);
    onMotion();
    media.addEventListener("change", onMotion);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => {
      media.removeEventListener("change", onMotion);
      observer.disconnect();
    };
  }, []);

  const running =
    autoplay && count > 1 && visible && !still && !focused && !(pauseOnHover && hovered);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => go(index + 1), interval * 1000);
    return () => clearInterval(timer);
  }, [running, index, interval, go]);

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription={t.slides}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      className="flex flex-col gap-4"
    >
      <ul
        ref={track}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <li
            key={i}
            aria-roledescription={t.slide}
            aria-label={t.position.replace("{n}", String(i + 1)).replace("{total}", String(count))}
            className="w-[86%] shrink-0 snap-center @3xl:w-[64%]"
          >
            <Frame
              item={item}
              hidden={i !== index}
              sizes="(min-width: 1024px) 900px, 90vw"
              className={cn("w-full", CAROUSEL_HEIGHTS[height])}
            />
          </li>
        ))}
      </ul>
      {count > 1 && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={t.goTo.replace("{n}", String(i + 1))}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
                className="grid size-6 place-items-center"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-[width,background-color] duration-300 ease-neon",
                    i === index ? "w-5 bg-accent" : "w-1.5 bg-line-2",
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["prev", "next"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                aria-label={t[dir]}
                onClick={() => go(index + (dir === "next" ? 1 : -1))}
                className="grid size-11 place-items-center rounded-btn border border-line-2 text-ink-2 transition-[color,border-color,transform] duration-200 hover:border-accent hover:text-ink active:scale-95"
              >
                <Icon
                  name="arrow"
                  size={18}
                  className={dir === "prev" ? "rotate-180" : undefined}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
