"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import {
  CatalogIndex,
  STATUSES,
  groupBySeries,
  sortTitles,
  statusText,
  titleHref,
  type ShelfStatus,
  type SortKey,
  type Title,
  type TitleKind,
} from "@/lib/catalog/catalog";
import { ru } from "@/i18n/ru";

import { Thumb, TitleCard } from "./pieces";

const t = ru.catalog.shelf;

type View = "series" | "grid" | "timeline";
type Choice = { filter: ShelfStatus | "all"; view: View; sort: SortKey };

const DEFAULT: Choice = { filter: "all", view: "series", sort: "recent" };
const VIEWS: View[] = ["series", "grid", "timeline"];
const SORTS: SortKey[] = ["recent", "year", "rating", "hours"];
const CHANGE = "zxc-shelf-change";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Choice {
  if (!raw) return DEFAULT;
  try {
    const value = JSON.parse(raw) as Partial<Choice>;
    return {
      filter:
        value.filter && (value.filter === "all" || STATUSES.includes(value.filter))
          ? value.filter
          : DEFAULT.filter,
      view: value.view && VIEWS.includes(value.view) ? value.view : DEFAULT.view,
      sort: value.sort && SORTS.includes(value.sort) ? value.sort : DEFAULT.sort,
    };
  } catch {
    return DEFAULT;
  }
}

/** The guest's filter, view and sort for this shelf, remembered in their browser. */
function useChoice(key: string): [Choice, (patch: Partial<Choice>) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(CHANGE, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(CHANGE, notify);
    };
  }, []);
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const choice = useMemo(() => parse(raw), [raw]);
  const update = useCallback(
    (patch: Partial<Choice>) => {
      try {
        window.localStorage.setItem(key, JSON.stringify({ ...choice, ...patch }));
      } catch {
        // Private mode or blocked storage: the choice just is not remembered.
      }
      window.dispatchEvent(new Event(CHANGE));
    },
    [key, choice],
  );
  return [choice, update];
}

const pill =
  "h-11 shrink-0 rounded-full border px-[18px] text-[15px] font-medium transition-colors duration-150";

type Props = {
  kind: TitleKind;
  /** Works of this kind that are on the shelf. */
  titles: Title[];
  /** Their series, by id. */
  series: Record<string, Title>;
  storageKey: string;
};

export function ShelfBrowser({ kind, titles, series, storageKey }: Props) {
  const [choice, update] = useChoice(storageKey);
  const index = useMemo(
    () => new CatalogIndex({ titles: [...titles, ...Object.values(series)], posts: [] }),
    [titles, series],
  );
  const count = (status: ShelfStatus) => titles.filter((x) => x.entry?.status === status).length;
  const list = sortTitles(
    titles.filter((x) => choice.filter === "all" || x.entry?.status === choice.filter),
    choice.sort,
  );

  let body;
  if (!list.length) {
    body = (
      <p className="rounded-lg border border-dashed border-line-2 py-24 text-center text-lg text-muted">
        {t.empty}
      </p>
    );
  } else if (choice.view === "grid") {
    body = <Cards items={list} />;
  } else if (choice.view === "timeline") {
    body = <Timeline items={list} />;
  } else {
    body = (
      <div className="flex flex-col gap-12">
        {groupBySeries(index, list).map((group) => {
          const all = group.series ? index.parts(group.series) : group.items;
          const done = all.filter((x) => x.entry?.status === "done").length;
          return (
            <section key={group.series?.id ?? "single"} aria-label={group.series?.name ?? t.single}>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="label">{group.series ? t.series : t.singleKind}</span>
                {group.series ? (
                  <a
                    href={titleHref(group.series)}
                    className="font-display text-2xl font-medium hover:text-accent"
                  >
                    {group.series.name}
                  </a>
                ) : (
                  <b className="font-display text-2xl font-medium">{t.single}</b>
                )}
                <span className="label">
                  {group.series
                    ? t.seriesMeta
                        .replace("{done}", String(done))
                        .replace("{total}", String(all.length))
                    : t.pieces.replace("{n}", String(group.items.length))}
                </span>
              </div>
              <Cards items={group.items} />
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex gap-10">
        {(["done", "active", "planned"] as const).map((status) => (
          <div key={status} className="flex flex-col gap-2">
            <span
              className={cn(
                "font-display text-cstat font-medium",
                status === "done" && "text-accent",
              )}
            >
              {count(status)}
            </span>
            <span className="label">{statusText(kind, status).toLowerCase()}</span>
          </div>
        ))}
      </div>
      <div className="mb-10 flex flex-col gap-4 border-y border-line py-5 @4xl:flex-row @4xl:items-center">
        <div
          role="group"
          aria-label={t.filterLabel}
          className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 @4xl:mx-0 @4xl:px-0"
        >
          {(["all", ...STATUSES] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={choice.filter === f}
              onClick={() => update({ filter: f })}
              className={cn(
                pill,
                choice.filter === f
                  ? "border-ink bg-ink text-bg"
                  : "border-line-2 text-ink-2 hover:border-ink hover:text-ink",
              )}
            >
              {f === "all" ? t.all : statusText(kind, f)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label={t.viewLabel}
            className="flex gap-1 rounded-md border border-line p-1"
          >
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={choice.view === v}
                onClick={() => update({ view: v })}
                className={cn(
                  "h-9 rounded-[9px] px-3 text-sm font-medium transition-colors",
                  choice.view === v
                    ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line-2)]"
                    : "text-muted hover:text-ink",
                )}
              >
                {t.views[v]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 text-sm text-muted">
            {t.sort}
            <select
              value={choice.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
              className="h-11 rounded-btn border border-line-2 bg-surface px-3.5 text-[15px] text-ink"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.sorts[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {body}
    </div>
  );
}

function Cards({ items }: { items: Title[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-3 @3xl:gap-6 @5xl:grid-cols-4">
      {items.map((x) => (
        <TitleCard key={x.id} title={x} />
      ))}
    </div>
  );
}

function Timeline({ items }: { items: Title[] }) {
  const years = new Map<number, Title[]>();
  for (const x of items) {
    const year = x.year ?? 0;
    years.set(year, [...(years.get(year) ?? []), x]);
  }
  const order = [...years.keys()].sort((a, b) => b - a);
  return (
    <ol className="border-t border-line">
      {order.map((year) => (
        <li
          key={year}
          className="grid gap-4 border-b border-line py-6 @3xl:grid-cols-[120px_minmax(0,1fr)] @3xl:gap-6"
        >
          <span className="font-display text-[32px] leading-none font-medium text-muted">
            {year || "—"}
          </span>
          <span className="flex flex-wrap gap-3">
            {years.get(year)!.map((x) => (
              <a
                key={x.id}
                href={titleHref(x)}
                className="flex h-14 items-center gap-3 rounded-md border border-line bg-surface pr-5 pl-2 transition-[border-color,transform] duration-200 ease-neon hover:-translate-y-0.5 hover:border-line-2"
              >
                <Thumb title={x} className="size-10" />
                <span>
                  <b className="block leading-tight font-medium">{x.name}</b>
                  {x.entry && <span className="label">{statusText(x.kind, x.entry.status)}</span>}
                </span>
              </a>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}
