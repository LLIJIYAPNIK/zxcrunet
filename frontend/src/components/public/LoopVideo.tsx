"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

/**
 * A silent endless clip (section backgrounds, loops, carousel slides). It plays only while
 * on screen and never for visitors who asked for less motion: they see the first frame
 * or the poster.
 */
export function LoopVideo({
  src,
  poster,
  className,
  label,
}: {
  src: string;
  poster?: string;
  className?: string;
  /** Accessible name; decorative clips (backgrounds) leave it empty. */
  label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;

    const sync = () => {
      if (visible && !still.matches) void video.play().catch(() => undefined);
      else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(video);
    still.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      still.removeEventListener("change", sync);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn("object-cover", className)}
    />
  );
}
