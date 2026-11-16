/**
 * Media blocks: «Видео» (a hosted player or an uploaded clip) and «Карусель».
 * Pure renders; motion lives in the client components they use.
 */
import type { CSSProperties } from "react";

import { Marquee, Slides } from "@/components/public/Carousel";
import { LoopVideo } from "@/components/public/LoopVideo";
import { ru } from "@/i18n/ru";
import { cn } from "@/lib/cn";
import { PROVIDER_NAMES, embedSrc } from "@/lib/embed";

import type { Aspect } from "./schemas";
import { CWRAP, SectionHead, type BlockProps as Props } from "./ui";

const ASPECT: Record<Aspect, string> = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "4:3": "4 / 3",
  "1:1": "1 / 1",
  "21:9": "21 / 9",
};

/** Upright clips stay phone-sized instead of filling a desktop screen. */
const UPRIGHT = new Set<Aspect>(["9:16"]);

function Video({ id, settings: s }: Props<"video">) {
  const embed = s.source === "embed" ? s.embed : null;
  const file = s.source === "file" ? s.file : null;
  if (!embed && !file) return null;
  const frame: CSSProperties = { aspectRatio: ASPECT[s.aspect] };
  const name = s.title || (embed ? PROVIDER_NAMES[embed.provider] : ru.publicSite.video.player);

  return (
    <section id={id} className={cn(CWRAP, "scroll-mt-20 py-14 @3xl:py-18")}>
      <SectionHead label={s.label} title={s.title || undefined} />
      {s.lead && (
        <p className="-mt-4 mb-8 max-w-[40em] text-clead whitespace-pre-line text-ink-2 @3xl:-mt-6">
          {s.lead}
        </p>
      )}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-line bg-raised",
          UPRIGHT.has(s.aspect) && "mx-auto w-full max-w-[420px]",
        )}
        style={frame}
      >
        {embed ? (
          <iframe
            src={embedSrc(embed)}
            title={name}
            loading="lazy"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
          />
        ) : file && s.mode === "loop" ? (
          <LoopVideo
            src={file.url}
            poster={s.poster?.url}
            label={name}
            className="absolute inset-0 size-full"
          />
        ) : file ? (
          <video
            src={file.url}
            poster={s.poster?.url}
            controls
            playsInline
            preload="metadata"
            aria-label={name}
            className="absolute inset-0 size-full bg-black object-contain"
          />
        ) : null}
      </div>
    </section>
  );
}

function CarouselBlock({ id, settings: s, ctx }: Props<"carousel">) {
  if (!s.items.length) return null;
  const label = s.title || s.label || ctx.siteTitle;
  return (
    <section id={id} className="scroll-mt-20 py-14 @3xl:py-18">
      {(s.label || s.title) && (
        <div className={CWRAP}>
          <SectionHead label={s.label} title={s.title || undefined} />
        </div>
      )}
      {s.mode === "marquee" ? (
        <Marquee
          items={s.items}
          speed={s.speed}
          direction={s.direction}
          height={s.height}
          pauseOnHover={s.pause_on_hover}
          label={label}
        />
      ) : (
        <div className={CWRAP}>
          <Slides
            items={s.items}
            autoplay={s.autoplay}
            interval={s.interval}
            height={s.height}
            pauseOnHover={s.pause_on_hover}
            label={label}
          />
        </div>
      )}
    </section>
  );
}

export const MEDIA_RENDERERS = {
  video: Video,
  carousel: CarouselBlock,
};
