import { describe, expect, it } from "vitest";

import { SAMPLE_CATALOG } from "@/blocks/sample-personal";

import {
  CatalogIndex,
  favoriteCharacters,
  finishedByMonth,
  groupBySeries,
  initials,
  kindFromPath,
  nowPlaying,
  progressText,
  seriesStats,
  sortTitles,
  titleHref,
  works,
  yearsText,
} from "./catalog";

const index = new CatalogIndex(SAMPLE_CATALOG);
const ds = index.find("game", "dark-souls")!;

describe("catalog helpers", () => {
  it("builds title addresses per kind", () => {
    expect(titleHref(ds)).toBe("/games/dark-souls");
    expect(kindFromPath("films")).toBe("film");
    expect(kindFromPath("music")).toBeNull();
  });

  it("orders the parts of a series and sums them up", () => {
    expect(index.parts(ds).map((p) => p.part_label)).toEqual(["I", "II", "III"]);
    expect(seriesStats(index, ds)).toMatchObject({ done: 2, hours: 142, rating: 9 });
    expect(yearsText(ds)).toBe("2011–2016");
  });

  it("groups shelf cards under their series, standalone last", () => {
    const groups = groupBySeries(index, works(index.ofKind("game")));
    expect(groups[0].series?.name).toBe("Dark Souls");
    expect(groups.at(-1)?.series).toBeNull();
    expect(groups.at(-1)?.items.map((t) => t.name)).toContain("Elden Ring");
  });

  it("shows what is in progress with readable progress", () => {
    const now = nowPlaying(SAMPLE_CATALOG, ["game", "book", "series"], 3);
    expect(now.map((t) => t.name)).toEqual([
      "Elden Ring",
      "Думай медленно… Решай быстро",
      "Лучше звоните Солу",
    ]);
    expect(now.map(progressText)).toEqual(["86 ч наиграно", "стр. 212 из 499", "сезон 3 из 6"]);
  });

  it("counts finished books per month for the challenge", () => {
    const months = finishedByMonth(SAMPLE_CATALOG, "book", 2026);
    expect(months.reduce((a, b) => a + b, 0)).toBe(7);
    expect(months[0]).toBe(1);
    expect(finishedByMonth(SAMPLE_CATALOG, "book", 2025).every((n) => n === 0)).toBe(true);
  });

  it("collects favourite characters from every universe", () => {
    expect(favoriteCharacters(SAMPLE_CATALOG).map((c) => c.name)).toEqual([
      "Солер из Асторы",
      "Геральт из Ривии",
      "Леви",
      "Сол Гудман",
      "Пол Атрейдес",
    ]);
  });

  it("sorts by rating and finds posts about a series and its parts", () => {
    expect(sortTitles(index.ofKind("film"), "rating")[0].name).toBe("Дюна: Часть вторая");
    expect(index.postsAbout(ds).map((p) => p.heading)).toEqual(["Dark Souls III закрывает круг"]);
    expect(initials("Гвин, Повелитель Пепла")).toBe("ГП");
  });
});
