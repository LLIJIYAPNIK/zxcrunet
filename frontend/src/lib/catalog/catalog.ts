/**
 * The owner's catalog as public pages and the builder preview see it: pure helpers,
 * safe on the server and in the browser. Types come from the generated API schema.
 */
import type { Schemas } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

export type Title = Schemas["TitleOut"];
export type Post = Schemas["PostOut"];
export type Entry = Schemas["EntryOut"];
export type Details = Schemas["Details"];
export type TitleKind = Title["kind"];
export type ShelfStatus = Entry["status"];
export type Catalog = { titles: Title[]; posts: Post[] };

export const EMPTY_CATALOG: Catalog = { titles: [], posts: [] };
export const TITLE_KINDS = ["game", "book", "anime", "series", "film"] as const;
export const STATUSES = ["active", "done", "planned", "dropped"] as const;

/** URL segment of each kind: `/games/dark-souls`. */
export const KIND_PATH: Record<TitleKind, string> = {
  game: "games",
  book: "books",
  anime: "anime",
  series: "series",
  film: "films",
};

export function kindFromPath(segment: string): TitleKind | null {
  const found = TITLE_KINDS.find((kind) => KIND_PATH[kind] === segment);
  return found ?? null;
}

export function titleHref(title: Pick<Title, "kind" | "slug">): string {
  return `/${KIND_PATH[title.kind]}/${title.slug}`;
}

export function statusText(kind: TitleKind, status: ShelfStatus): string {
  return ru.catalog.status[kind][status];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

export function yearsText(title: Pick<Title, "year" | "year_end">): string {
  if (!title.year) return "";
  return title.year_end && title.year_end !== title.year
    ? `${title.year}–${title.year_end}`
    : String(title.year);
}

export function details(title: Title): Required<Details> {
  const d = title.entry?.details;
  return {
    criteria: d?.criteria ?? [],
    plot: d?.plot ?? [],
    characters: d?.characters ?? [],
    bosses: d?.bosses ?? [],
    tracks: d?.tracks ?? [],
    extras: d?.extras ?? [],
    screenshots: d?.screenshots ?? [],
    related: d?.related ?? [],
    place: d?.place ?? "",
    favorite_part: d?.favorite_part ?? "",
  };
}

export class CatalogIndex {
  readonly byId: Map<string, Title>;

  constructor(readonly catalog: Catalog) {
    this.byId = new Map(catalog.titles.map((t) => [t.id, t]));
  }

  get(id: string | null | undefined): Title | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  find(kind: TitleKind, slug: string): Title | undefined {
    return this.catalog.titles.find((t) => t.kind === kind && t.slug === slug);
  }

  ofKind(kind: TitleKind): Title[] {
    return this.catalog.titles.filter((t) => t.kind === kind);
  }

  /** Parts of a series in reading/playing order. */
  parts(series: Title): Title[] {
    return this.catalog.titles
      .filter((t) => t.series_id === series.id)
      .sort((a, b) => a.position - b.position || (a.year ?? 0) - (b.year ?? 0));
  }

  series(title: Title): Title | undefined {
    return this.get(title.series_id);
  }

  /** A title and, for a series, all of its parts (posts and related look at all of them). */
  family(title: Title): Title[] {
    return title.is_series ? [title, ...this.parts(title)] : [title];
  }

  postsAbout(title: Title): Post[] {
    const ids = new Set(this.family(title).map((t) => t.id));
    return this.catalog.posts.filter((p) => p.title_id && ids.has(p.title_id));
  }
}

/** Shelf items of a kind: works only (a series is a heading, not a card). */
export function works(titles: Title[]): Title[] {
  return titles.filter((t) => !t.is_series);
}

export type SortKey = "recent" | "year" | "rating" | "hours";

export function sortTitles(titles: Title[], key: SortKey): Title[] {
  const value = (t: Title): number => {
    switch (key) {
      case "year":
        return t.year ?? 0;
      case "rating":
        return t.entry?.rating ?? 0;
      case "hours":
        return t.entry?.hours ?? 0;
      default:
        return Date.parse(t.updated_at ?? "") || 0;
    }
  };
  return [...titles].sort((a, b) => value(b) - value(a));
}

export type SeriesGroup = { series: Title | null; items: Title[] };

/** Cards grouped under their series; standalone works go last. */
export function groupBySeries(index: CatalogIndex, items: Title[]): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();
  const single: Title[] = [];
  for (const item of items) {
    const series = index.series(item);
    if (!series) {
      single.push(item);
      continue;
    }
    const group = groups.get(series.id) ?? { series, items: [] };
    group.items.push(item);
    groups.set(series.id, group);
  }
  const result = [...groups.values()];
  if (single.length) result.push({ series: null, items: single });
  return result;
}

export type SeriesStats = {
  parts: Title[];
  done: number;
  hours: number;
  /** The series' own rating, or the average of its parts. */
  rating: number | null;
};

export function seriesStats(index: CatalogIndex, title: Title): SeriesStats {
  const parts = title.is_series ? index.parts(title) : [title];
  const rated = parts.map((p) => p.entry?.rating).filter((r): r is number => !!r);
  const own = title.entry?.rating ?? null;
  return {
    parts,
    done: parts.filter((p) => p.entry?.status === "done").length,
    hours: parts.reduce((sum, p) => sum + (p.entry?.hours ?? 0), 0),
    rating:
      own ?? (rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : null),
  };
}

/** 0..1 for a progress bar, or null when there is nothing to show. */
export function progressValue(title: Title): number | null {
  const e = title.entry;
  if (!e || e.progress == null || !e.progress_total) return null;
  return Math.min(1, e.progress / e.progress_total);
}

export function progressText(title: Title): string {
  const e = title.entry;
  if (!e) return "";
  const t = ru.catalog.progressText;
  if (title.kind === "game") return e.hours ? t.game.replace("{hours}", String(e.hours)) : "";
  if (e.progress == null || !e.progress_total) return "";
  return t[title.kind]
    .replace("{n}", String(e.progress))
    .replace("{total}", String(e.progress_total));
}

/** «Сейчас»: what is in progress, most recently touched first. */
export function nowPlaying(catalog: Catalog, kinds: readonly TitleKind[], limit: number): Title[] {
  const wanted = new Set(kinds);
  return sortTitles(
    works(catalog.titles).filter((t) => wanted.has(t.kind) && t.entry?.status === "active"),
    "recent",
  ).slice(0, limit);
}

export type FavoriteCharacter = {
  name: string;
  role: string;
  avatar: Schemas["MediaRef"] | null;
  title: Title;
};

export function favoriteCharacters(catalog: Catalog): FavoriteCharacter[] {
  return catalog.titles.flatMap((title) =>
    details(title)
      .characters.filter((c) => c.favorite)
      .map((c) => ({ name: c.name, role: c.role, avatar: c.avatar ?? null, title })),
  );
}

/** Finished works of a kind per month of `year` (index 0 = January). */
export function finishedByMonth(catalog: Catalog, kind: TitleKind, year: number): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  for (const t of works(catalog.titles)) {
    const finished = t.entry?.status === "done" ? t.entry.finished_on : null;
    if (t.kind !== kind || !finished) continue;
    const [y, m] = finished.split("-").map(Number);
    if (y === year && m >= 1 && m <= 12) months[m - 1] += 1;
  }
  return months;
}

/** Genre counts on a shelf, most common first. */
export function genreCounts(titles: Title[]): { genre: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of titles) {
    const genre = t.genres[0];
    if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" })
    .format(date)
    .replace(/\s*г\.$/, "");
}
