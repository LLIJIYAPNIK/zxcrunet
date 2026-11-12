/**
 * A personal card built like the reference «Профиль · личное», with the Dark Souls series
 * from «Игра · серия Dark Souls» (fictional owner). Used by /ui/sample/personal and tests.
 */
import type { Catalog, Title } from "@/lib/catalog/catalog";

import type { AnyBlock } from "./schemas";

const tid = (n: number) => `0195f3a0-0000-7000-9000-${String(n).padStart(12, "0")}`;
const bid = (n: number) => `0195f3a0-0000-7000-a000-${String(n).padStart(12, "0")}`;

type Entry = NonNullable<Title["entry"]>;
type Partial2 = Partial<Omit<Title, "entry">> & {
  entry?: (Partial<Omit<Entry, "details">> & { details?: Partial<Entry["details"]> }) | null;
};

let clock = Date.UTC(2026, 10, 1);

function title(n: number, kind: Title["kind"], name: string, extra: Partial2 = {}): Title {
  clock -= 3_600_000;
  const { entry, ...rest } = extra;
  return {
    id: tid(n),
    kind,
    name,
    slug:
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `t-${n}`,
    year: null,
    year_end: null,
    creator: "",
    genres: [],
    description: "",
    cover: null,
    is_series: false,
    series_id: null,
    part_label: "",
    position: 0,
    updated_at: new Date(clock).toISOString(),
    ...rest,
    entry:
      entry === null
        ? null
        : {
            status: "done",
            rating: null,
            hours: null,
            progress: null,
            progress_total: null,
            favorite: false,
            started_on: null,
            finished_on: null,
            notes: "",
            ...entry,
            details: {
              place: "",
              favorite_part: "",
              ...entry?.details,
            },
          },
  };
}

const DS = tid(1);

export const SAMPLE_CATALOG: Catalog = {
  titles: [
    title(1, "game", "Dark Souls", {
      is_series: true,
      creator: "FromSoftware",
      year: 2011,
      year_end: 2016,
      genres: ["soulslike", "тёмное фэнтези", "action RPG"],
      entry: {
        rating: 9,
        details: {
          favorite_part: "III",
          place: "",
          criteria: [
            { name: "Сюжет и лор", score: 9 },
            { name: "Геймплей", score: 10 },
            { name: "Атмосфера", score: 10 },
            { name: "Саундтрек", score: 9 },
            { name: "Сложность", score: 8 },
          ],
          plot: [
            {
              label: "Завязка",
              text: "Огонь угасает, нежить бродит по Лордрану. Избранный должен решить: разжечь Пламя или дать эпохе закончиться.",
              spoiler: false,
            },
            {
              label: "Акт I",
              text: "Колокола пробуждения, Сен и Анор Лондо: путь к Повелителю Пепла открыт.",
              spoiler: true,
            },
            {
              label: "Акт II",
              text: "Четыре великие души: Нито, Ведьма Изалита, Сит и Четыре короля.",
              spoiler: true,
            },
            { label: "Финалы", text: "Видел обе концовки, выбрал Эпоху Тьмы.", spoiler: true },
          ],
          characters: [
            { name: "Солер из Асторы", role: "союзник, воин Солнца", parts: ["I"], favorite: true },
            {
              name: "Гвин, Повелитель Пепла",
              role: "финальный босс",
              parts: ["I"],
              favorite: false,
            },
            { name: "Андре из Асторы", role: "кузнец", parts: ["I", "III"], favorite: false },
            {
              name: "Патчес",
              role: "плут и вечный обманщик",
              parts: ["I", "III"],
              favorite: false,
            },
            {
              name: "Хранительница огня",
              role: "у костра, в каждой части своя",
              parts: ["I", "III"],
              favorite: false,
            },
          ],
          tracks: [
            { title: "Firelink Shrine", artist: "Мотои Сакураба", part: "I" },
            { title: "Gwyn, Lord of Cinder", artist: "Мотои Сакураба", part: "I" },
            { title: "Nameless King", artist: "Юка Китамура", part: "III" },
            { title: "Soul of Cinder", artist: "Юка Китамура", part: "III" },
          ],
          related: [
            { title_id: tid(4), name: "", note: "тот же разработчик" },
            { title_id: null, name: "Demon’s Souls", note: "предшественник" },
          ],
        },
      },
    }),
    title(2, "game", "Dark Souls", {
      slug: "dark-souls-1",
      series_id: DS,
      part_label: "I",
      position: 1,
      year: 2011,
      genres: ["soulslike"],
      entry: {
        hours: 64,
        rating: 9,
        details: { extras: [{ name: "Artorias of the Abyss", done: true }] },
      },
    }),
    title(3, "game", "Dark Souls II", {
      series_id: DS,
      part_label: "II",
      position: 2,
      year: 2014,
      genres: ["soulslike"],
      entry: {
        status: "planned",
        details: {
          extras: [
            { name: "Crown of the Sunken King", done: false },
            { name: "Crown of the Old Iron King", done: false },
            { name: "Crown of the Ivory King", done: false },
          ],
        },
      },
    }),
    title(5, "game", "Dark Souls III", {
      series_id: DS,
      part_label: "III",
      position: 3,
      year: 2016,
      genres: ["soulslike"],
      entry: {
        hours: 78,
        rating: 10,
        details: {
          extras: [
            { name: "Ashes of Ariandel", done: true },
            { name: "The Ringed City", done: false },
          ],
          bosses: [
            { name: "Иудекс Гундир", note: "первый", defeated: true },
            { name: "Танцовщица Холодной долины", note: "", defeated: true },
            { name: "Понтифик Саливан", note: "", defeated: false },
            { name: "Безымянный король", note: "необязательный", defeated: false },
            { name: "Душа пепла", note: "финал", defeated: false },
          ],
        },
      },
    }),
    title(4, "game", "Elden Ring", {
      year: 2022,
      creator: "FromSoftware",
      genres: ["action RPG"],
      entry: { status: "active", hours: 86, progress: 62, progress_total: 100 },
    }),
    title(6, "game", "Ведьмак 3: Дикая Охота", {
      slug: "vedmak-3",
      year: 2015,
      genres: ["RPG"],
      entry: {
        hours: 120,
        details: {
          characters: [{ name: "Геральт из Ривии", role: "ведьмак", favorite: true }],
        },
      },
    }),
    title(7, "game", "Forza Horizon 5", { year: 2021, genres: ["гонки"], entry: { hours: 40 } }),
    title(8, "game", "Mortal Kombat 1", {
      year: 2023,
      genres: ["файтинг"],
      entry: { status: "dropped", hours: 6 },
    }),
    title(20, "book", "Ведьмак", {
      slug: "vedmak",
      is_series: true,
      creator: "Анджей Сапковский",
      entry: null,
    }),
    ...["Последнее желание", "Меч предназначения", "Кровь эльфов"].map((name, i) =>
      title(21 + i, "book", name, {
        slug: `vedmak-${i + 1}`,
        series_id: tid(20),
        part_label: String(i + 1),
        position: i + 1,
        creator: "Анджей Сапковский",
        entry: { favorite: true, finished_on: `2026-0${i + 1}-20` },
      }),
    ),
    title(24, "book", "Думай медленно… Решай быстро", {
      slug: "dumay-medlenno",
      creator: "Даниэль Канеман",
      entry: { status: "active", progress: 212, progress_total: 499 },
    }),
    ...[
      ["Стив Джобс", "2026-03-10"],
      ["Доставляя счастье", "2026-05-02"],
      ["Клиенты на всю жизнь", "2026-07-15"],
      ["Дюна", "2026-08-30"],
    ].map(([name, finished], i) =>
      title(25 + i, "book", name, { slug: `book-${i + 1}`, entry: { finished_on: finished } }),
    ),
    title(40, "anime", "Атака титанов", {
      slug: "attack-on-titan",
      creator: "WIT Studio → MAPPA",
      year: 2013,
      year_end: 2023,
      entry: {
        favorite: true,
        rating: 10,
        details: { characters: [{ name: "Леви", role: "капитан разведкорпуса", favorite: true }] },
      },
    }),
    title(50, "series", "Во все тяжкие", {
      slug: "breaking-bad",
      year: 2008,
      year_end: 2013,
      entry: {
        progress: 5,
        progress_total: 5,
        details: { characters: [{ name: "Сол Гудман", role: "адвокат", favorite: true }] },
      },
    }),
    title(51, "series", "Лучше звоните Солу", {
      slug: "better-call-saul",
      year: 2015,
      year_end: 2022,
      entry: { status: "active", progress: 3, progress_total: 6 },
    }),
    title(60, "film", "Дюна: Часть вторая", {
      slug: "dune-2",
      creator: "Дени Вильнёв",
      year: 2024,
      entry: {
        rating: 9,
        favorite: true,
        details: {
          place: "В кино · март 2024",
          characters: [{ name: "Пол Атрейдес", role: "Муад’Диб", favorite: true }],
        },
      },
    }),
    title(61, "film", "Дюна", {
      slug: "dune",
      creator: "Дени Вильнёв",
      year: 2021,
      entry: { rating: 8, details: { place: "Дома" } },
    }),
  ],
  posts: [
    {
      id: tid(90),
      kind: "review",
      heading: "Dark Souls III закрывает круг",
      body: "Третья часть собирает всё лучшее из первых двух и заканчивает историю Пламени. Пара абзацев про Безымянного короля и финал.",
      title_id: tid(5),
      published_on: "2026-10-12",
    },
    {
      id: tid(91),
      kind: "note",
      heading: "Короткий пост без привязки",
      body: "Мысль, фото или ссылка: заметка живёт в ленте сама по себе.",
      title_id: null,
      published_on: "2026-10-03",
    },
  ],
};

const block = <T extends AnyBlock["type"]>(n: number, type: T, settings: unknown): AnyBlock =>
  ({ id: bid(n), type, version: 1, hidden: false, settings }) as AnyBlock;

export const SAMPLE_PERSONAL_BLOCKS: AnyBlock[] = [
  block(1, "profile", {
    cover: null,
    avatar: null,
    title: "Саша Орлов: игры, книги и сериалы",
    lead: "Пишу бэкенд, преподаю программирование и однажды наряжался в Человека-паука. Здесь всё, что я люблю вне работы.",
    mood: "Дочитываю Канемана",
  }),
  block(2, "now", { label: "", kinds: ["game", "book", "anime", "series", "film"], limit: 3 }),
  block(3, "shelf", {
    kind: "game",
    style: "bento",
    label: "Серии собираются в стопку",
    title: "Игры",
    lead: "",
    controls: false,
    limit: 12,
    all_link: { label: "Весь раздел", url: "#" },
  }),
  block(4, "characters", { label: "Из всех вселенных сразу", title: "Мои персонажи" }),
  block(5, "shelf", {
    kind: "book",
    style: "spines",
    label: "Полка корешков",
    title: "Книги",
    lead: "",
    controls: false,
    limit: 12,
    all_link: null,
  }),
  block(6, "challenge", { label: "Челлендж года", kind: "book", year: 2026, goal: 15 }),
  block(7, "quotes", {
    label: "",
    title: "",
    items: [
      {
        text: "Ничто в жизни не важно настолько, насколько вам кажется, когда вы об этом думаете.",
        source: "Даниэль Канеман, «Думай медленно… Решай быстро»",
        title_id: tid(24),
      },
    ],
  }),
  block(8, "top", { label: "Личный топ", title: "Аниме", items: [tid(40)] }),
  block(9, "shelf", {
    kind: "series",
    style: "tracker",
    label: "Трекер сезонов",
    title: "Сериалы",
    lead: "",
    controls: false,
    limit: 6,
    all_link: null,
  }),
  block(10, "shelf", {
    kind: "film",
    style: "tickets",
    label: "Корешки билетов",
    title: "Фильмы",
    lead: "",
    controls: false,
    limit: 6,
    all_link: null,
  }),
  block(11, "playlist", {
    label: "Саундтреки со всех полок",
    title: "Плейлист",
    lead: "Каждый трек ведёт на свой тайтл.",
    items: [
      { track: "Firelink Shrine", artist: "Мотои Сакураба", title_id: DS, url: null },
      { track: "Guren no Yumiya", artist: "Linked Horizon", title_id: tid(40), url: null },
      { track: "Baby Blue", artist: "Badfinger", title_id: tid(50), url: null },
      { track: "Paul’s Dream", artist: "Ханс Циммер", title_id: tid(60), url: null },
    ],
  }),
  block(12, "posts", { label: "Лента", title: "Посты", kind: "all", limit: 6 }),
];

/** The «Игры» section page: one shelf with filters, sorting and views for guests. */
export const SAMPLE_GAMES_BLOCKS: AnyBlock[] = [
  block(20, "shelf", {
    kind: "game",
    style: "cards",
    label: "",
    title: "Игры",
    lead: "Части одной серии собираются вместе. Вид и фильтры запоминаются для гостей.",
    controls: true,
    limit: 60,
    all_link: null,
  }),
];
