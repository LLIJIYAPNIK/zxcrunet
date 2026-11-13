"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@/lib/cn";
import {
  hexToRgb,
  hsvToRgb,
  isHex,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
  type Hsv,
  type Rgb,
} from "@/lib/theme/color";
import { ru } from "@/i18n/ru";

type ColorPickerProps = {
  /** `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  label: string;
  className?: string;
};

const WHEEL =
  "radial-gradient(closest-side, #fff, rgba(255,255,255,0))," +
  "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Colour wheel (hue by angle, saturation by radius) with a brightness slider, plus HEX and
 * RGB fields. All four stay in sync; the parent gets a normalised `#rrggbb`.
 */
export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  const t = ru.palette;
  const wheel = useRef<HTMLDivElement>(null);

  // HSV is kept locally so hue survives grey and black (where RGB loses it).
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(value)));
  const [hexDraft, setHexDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setHexDraft(value);
    if (rgbToHex(hsvToRgb(hsv)) !== value) setHsv(rgbToHsv(hexToRgb(value)));
  }

  const rgb = hsvToRgb(hsv);
  const hexInvalid = hexDraft.trim() !== "" && !isHex(hexDraft);

  function commitHsv(next: Hsv) {
    setHsv(next);
    const hex = rgbToHex(hsvToRgb(next));
    setSeen(hex);
    setHexDraft(hex);
    onChange(hex);
  }

  function commitRgb(next: Rgb) {
    commitHsv(rgbToHsv(next));
  }

  function pick(e: PointerEvent<HTMLDivElement>) {
    const box = wheel.current?.getBoundingClientRect();
    if (!box) return;
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    const radius = box.width / 2;
    const h = (Math.atan2(dx, -dy) * 180) / Math.PI;
    commitHsv({
      h: (h + 360) % 360,
      s: clamp(Math.hypot(dx, dy) / radius, 0, 1),
      v: hsv.v,
    });
  }

  function onWheelKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { h: (hsv.h - step + 360) % 360 },
      ArrowRight: { h: (hsv.h + step) % 360 },
      ArrowUp: { s: clamp(hsv.s + step / 100, 0, 1) },
      ArrowDown: { s: clamp(hsv.s - step / 100, 0, 1) },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    commitHsv({ ...hsv, ...move });
  }

  const angle = (hsv.h * Math.PI) / 180;
  const thumb = {
    left: `${50 + 50 * hsv.s * Math.sin(angle)}%`,
    top: `${50 - 50 * hsv.s * Math.cos(angle)}%`,
  };
  const pure = rgbToHex(hsvToRgb({ h: hsv.h, s: hsv.s, v: 1 }));

  return (
    <div
      className={cn("flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7", className)}
      role="group"
      aria-label={label}
    >
      <div
        ref={wheel}
        role="slider"
        tabIndex={0}
        aria-label={t.wheel}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`${t.hue} ${Math.round(hsv.h)}°, ${t.saturation} ${Math.round(hsv.s * 100)}%`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
        }}
        onKeyDown={onWheelKey}
        className="relative size-[200px] shrink-0 cursor-crosshair touch-none self-center rounded-full outline-offset-4 select-none sm:size-[176px]"
        style={{ backgroundImage: WHEEL }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-black"
          style={{ opacity: 1 - hsv.v }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-6 -translate-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,.4),0_2px_8px_rgba(0,0,0,.5)]"
          style={{ ...thumb, background: rgbToHex(rgb) }}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">{t.brightness}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(hsv.v * 100)}
            onChange={(e) => commitHsv({ ...hsv, v: Number(e.target.value) / 100 })}
            className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
            style={{ background: `linear-gradient(to right, #000, ${pure})` }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">{t.customLabel}</span>
          <span
            className={cn(
              "flex h-12 items-center gap-3 rounded-md border bg-surface px-3.5 transition-colors focus-within:border-accent",
              hexInvalid ? "border-[#ff6b6b]" : "border-line-2",
            )}
          >
            <span
              aria-hidden="true"
              className="size-6 shrink-0 rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]"
              style={{ background: isHex(hexDraft) ? normalizeHex(hexDraft) : "transparent" }}
            />
            <input
              value={hexDraft}
              onChange={(e) => {
                const next = e.target.value;
                setHexDraft(next);
                if (isHex(next)) {
                  const hex = normalizeHex(next);
                  setHsv(rgbToHsv(hexToRgb(hex)));
                  setSeen(hex);
                  onChange(hex);
                }
              }}
              spellCheck={false}
              autoComplete="off"
              maxLength={7}
              aria-invalid={hexInvalid}
              placeholder="#5ab9fc"
              className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </span>
          {hexInvalid && <span className="text-[13px] text-[#ff6b6b]">{t.invalidHex}</span>}
        </label>

        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">RGB</legend>
          {(["R", "G", "B"] as const).map((channel, i) => (
            <label
              key={channel}
              className="flex h-12 items-center gap-2 rounded-md border border-line-2 bg-surface px-3 focus-within:border-accent"
            >
              <span className="font-mono text-[13px] text-muted">{channel}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={255}
                value={rgb[i]}
                aria-label={channel}
                onChange={(e) => {
                  const n = clamp(Math.round(Number(e.target.value) || 0), 0, 255);
                  const next = [...rgb] as [number, number, number];
                  next[i] = n;
                  commitRgb(next);
                }}
                className="w-full min-w-0 bg-transparent font-mono text-[15px] text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
