"use client";

import { useRef, useState, type CSSProperties } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  title: string;
  artist: string;
  color: string;
  background: string;
  animation: "none" | "equalizer" | "vinyl";
  progressStyle: "line" | "wave" | "segments";
};

const WAVE = [
  4, 7, 11, 6, 14, 9, 18, 8, 12, 5, 16, 9, 20, 7, 13, 5, 17, 10, 6, 15, 8, 19, 11, 5, 14, 8, 17, 6,
  12, 4, 16, 9, 20, 7, 13, 5, 18, 10, 6, 14, 8, 17, 5, 12, 7, 19, 10, 4,
];

function timeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function AudioPlayer({
  src,
  title,
  artist,
  color,
  background,
  animation,
  progressStyle,
}: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const played = duration > 0 ? Math.min(1, current / duration) : 0;

  function toggle() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      void element.play().catch(() => setPlaying(false));
    } else {
      element.pause();
    }
  }

  function seek(value: number) {
    if (!audio.current || !Number.isFinite(duration)) return;
    audio.current.currentTime = value;
    setCurrent(value);
  }

  return (
    <div
      className="flex size-full min-h-0 flex-col justify-center gap-3.5 p-4 @3xl:p-6"
      style={{ color, backgroundColor: background }}
    >
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        className="sr-only"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
      />

      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Приостановить" : "Воспроизвести"}
          className="grid size-11 shrink-0 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          style={{ backgroundColor: color, color: background }}
        >
          {playing ? (
            <span aria-hidden="true" className="flex gap-1">
              <span className="h-4 w-1 rounded-sm bg-current" />
              <span className="h-4 w-1 rounded-sm bg-current" />
            </span>
          ) : (
            <Icon name="play" size={17} className="ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {title || "Без названия"}
          </p>
          <p className="mt-1 truncate text-[13px] leading-tight opacity-65">
            {artist || "Аудиозапись"}
          </p>
        </div>

        {animation !== "none" && (
          <span
            aria-hidden="true"
            className={cn(
              "flex h-7 shrink-0 items-center justify-center gap-[3px] text-current",
              animation === "vinyl" && "size-8 rounded-full border border-current/40",
              animation === "vinyl" && playing && "animate-spin [animation-duration:3s]",
            )}
          >
            {animation === "vinyl" ? (
              <span className={cn("size-2 rounded-full bg-current", playing && "animate-pulse")} />
            ) : (
              [8, 15, 11, 19, 9].map((height, index) => (
                <span
                  key={index}
                  className={cn("w-[3px] rounded-full bg-current", playing && "animate-pulse")}
                  style={{
                    height,
                    animationDelay: `${index * 90}ms`,
                    animationDuration: "700ms",
                  }}
                />
              ))
            )}
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium tabular-nums opacity-70">
        <span className="w-8 text-right">{timeLabel(current)}</span>
        <div className="relative h-5 min-w-0 flex-1">
          {progressStyle === "wave" ? (
            <div className="flex h-full items-center justify-between gap-[2px]" aria-hidden="true">
              {WAVE.map((height, index) => (
                <span
                  key={index}
                  className="min-w-[2px] flex-1 rounded-full"
                  style={{
                    height,
                    backgroundColor: index / WAVE.length <= played ? color : `${color}55`,
                  }}
                />
              ))}
            </div>
          ) : progressStyle === "segments" ? (
            <div className="flex h-full items-center justify-between gap-[3px]" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => (
                <span
                  key={index}
                  className="h-1.5 min-w-[2px] flex-1 rounded-full"
                  style={{ backgroundColor: index / 24 <= played ? color : `${color}55` }}
                />
              ))}
            </div>
          ) : (
            <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-full bg-current/25">
              <span
                className="block h-full rounded-full"
                style={{ width: `${played * 100}%`, backgroundColor: color }}
              />
            </div>
          )}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(current, duration || 1)}
            onChange={(event) => seek(Number(event.currentTarget.value))}
            aria-label="Позиция воспроизведения"
            aria-valuetext={`${timeLabel(current)} из ${timeLabel(duration)}`}
            style={{ "--player-accent": color } as CSSProperties}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 focus-visible:opacity-100 focus-visible:outline-none [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--player-accent)] [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--player-accent)]"
          />
        </div>
        <span className="w-8">{timeLabel(duration)}</span>
      </div>
    </div>
  );
}
