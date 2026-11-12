"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

type Section = { label: string; text: string; spoiler: boolean };

/** Plot sections; spoilers stay blurred until the guest asks to see them. */
export function Spoilers({ title, sections }: { title: string; sections: Section[] }) {
  const [shown, setShown] = useState(false);
  const t = ru.catalog.page;
  const hasSpoilers = sections.some((s) => s.spoiler);
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-ch2 font-medium">{title}</h2>
        {hasSpoilers && (
          <Button variant="secondary" aria-pressed={shown} onClick={() => setShown((v) => !v)}>
            {shown ? t.hideSpoilers : t.showSpoilers}
          </Button>
        )}
      </div>
      <div className="overflow-x-clip border-t border-line">
        {sections.map((s, i) => (
          <div
            key={i}
            className="grid gap-2 border-b border-line py-5 @3xl:grid-cols-[120px_minmax(0,1fr)] @3xl:gap-6"
          >
            <span className="label">{s.label}</span>
            <p
              className={cn(
                "whitespace-pre-line text-ink-2 transition-[filter] duration-300",
                s.spoiler && !shown && "blur-[7px] select-none",
              )}
              aria-hidden={s.spoiler && !shown ? true : undefined}
            >
              {s.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
