"use client";

import { useId, useState } from "react";

import { formatCount, formatDay } from "@/lib/admin/admin";
import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

const t = ru.admin.overview;

export type DayValue = { day: string; value: number };

/**
 * One series per day as thin columns in the accent colour: a hover (or focus) tooltip per
 * day, a recessive baseline with the first and last date, and the same numbers as a table.
 */
export function DayBars({
  title,
  summary,
  data,
  height = 140,
}: {
  title: string;
  summary: string;
  data: readonly DayValue[];
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const max = Math.max(1, ...data.map((d) => d.value));
  const shown = active !== null ? data[active] : null;
  const last = data.at(-1);

  return (
    <figure aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span id={titleId} className="font-medium text-ink">
          {title}
        </span>
        <span className="text-sm text-muted" aria-live="polite">
          {shown ? `${formatDay(shown.day, true)}: ${formatCount(shown.value)}` : summary}
        </span>
      </figcaption>

      <div
        className="relative flex items-end gap-[2px] border-b border-line"
        style={{ height }}
        onMouseLeave={() => setActive(null)}
      >
        {data.map((d, i) => (
          <button
            key={d.day}
            type="button"
            aria-label={`${formatDay(d.day, true)}: ${d.value}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="group relative flex h-full min-w-0 flex-1 items-end outline-none"
          >
            <span
              className={cn(
                "w-full rounded-t-[4px] bg-accent transition-opacity duration-150",
                d.value === 0 && "bg-line-2",
                active !== null && active !== i && "opacity-45",
                "group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink",
              )}
              style={{ height: d.value === 0 ? 2 : `${Math.max(3, (d.value / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[12px] text-muted">
        <span>{data[0] ? formatDay(data[0].day) : ""}</span>
        <span>{t.max.replace("{n}", formatCount(max))}</span>
        <span>{last ? formatDay(last.day) : ""}</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">{t.table}</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t.day}</th>
                <th className="px-3 py-2 text-right font-medium">{t.value}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-1.5 text-ink-2">{formatDay(d.day, true)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
