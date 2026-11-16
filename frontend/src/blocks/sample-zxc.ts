/**
 * A «zxc» card: someone who photographs sunsets and counts them down like 1000 − 7.
 * Sunset photos are CC0 / public domain from Wikimedia Commons (public/demo/zxc/CREDITS.txt).
 * Used by /ui/sample/zxc and `pnpm seed:demo`, which uploads the files and swaps the
 * `/demo/zxc/…` addresses for real `/media/…` ones.
 */
// Types only: the demo seed imports this file with Node's type stripping (no bundler).
import type { Appearance, AnyBlock, MediaRef, Place, SettingsOf, Tile } from "./schemas";

export const ZXC_FILES = {
  lonely: { file: "lonely.webp", width: 1600, height: 1064 },
  wires: { file: "wires.webp", width: 1600, height: 1067 },
  pylon: { file: "pylon.webp", width: 1245, height: 1600 },
  city: { file: "city.webp", width: 1600, height: 738 },
  roofs: { file: "roofs.webp", width: 1600, height: 1200 },
  trees: { file: "trees.webp", width: 1600, height: 900 },
  lamp: { file: "lamp.webp", width: 1600, height: 1200 },
  redlines: { file: "redlines.webp", width: 1600, height: 1075 },
  clouds: { file: "clouds.webp", width: 1600, height: 1055 },
  dusk: { file: "dusk.webp", width: 1600, height: 738 },
  tall: { file: "tall.webp", width: 739, height: 1600 },
  field: { file: "field.webp", width: 1200, height: 1600 },
  station: { file: "station.webp", width: 1600, height: 1200 },
  sea: { file: "sea.webp", width: 1600, height: 1067 },
  windmills: { file: "windmills.webp", width: 1600, height: 1200 },
} as const;

export type ZxcName = keyof typeof ZXC_FILES;

const id = (n: number) => `0196b000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const FILE_IDS = Object.fromEntries(
  Object.keys(ZXC_FILES).map((name, i) => [name, id(100 + i)]),
) as Record<ZxcName, string>;

export function zxc(name: ZxcName): MediaRef {
  const { file, width, height } = ZXC_FILES[name];
  return { id: FILE_IDS[name], url: `/demo/zxc/${file}`, width, height };
}

const BASE: Appearance = {
  background: "none",
  color: "#121722",
  color2: "#05070b",
  angle: 180,
  image: null,
  video: null,
  dim: 45,
  pattern: "dots",
  space: "none",
  divider: "none",
  heading_font: "",
  body_font: "",
};
const look = (patch: Partial<Appearance>): Appearance => ({ ...BASE, ...patch });

function tile(tid: string, kind: Tile["kind"], desktop: Place, extra: Partial<Tile> = {}): Tile {
  return {
    id: tid,
    kind,
    media: null,
    embed: null,
    text: "",
    text_style: "body",
    align: "left",
    link: null,
    fill: "none",
    fit: "cover",
    rounded: false,
    alt: "",
    desktop,
    phone: null,
    layer: 1,
    ...extra,
  };
}

const photo = (tid: string, name: ZxcName, desktop: Place, alt: string, layer = 1) =>
  tile(tid, "image", desktop, { media: zxc(name), alt, layer });

/** 1000 − 7, 993 − 7, …: the first `count` steps of the countdown. */
function countdown(from: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = from - 7 * i;
    return `${n} − 7 = ${n - 7}`;
  });
}

const COLLAGE_ID = id(3);

const hero: SettingsOf<"hero"> = {
  label: "zxc · dead inside · 18:47",
  title: "Я фотографирую закат",
  lead: "Каждый вечер одно и то же небо, и каждый раз другое. Считаю закаты как 1000 − 7: сегодня был 993-й. Завтра будет 986-й.",
  primary: { label: "Смотреть закаты", url: `#b-${COLLAGE_ID.slice(-8)}` },
  secondary: { label: "Написать в 3 ночи", url: "https://t.me/zxc_993" },
  card_name: "",
  card_role: "",
  avatar: null,
  chips: [],
  pattern: "none",
  layout: "fullscreen",
  media: [],
  background: zxc("lonely"),
  dim: 35,
  align: "left",
};

/** The big counter: six steps in a row, glitching. */
const counter: SettingsOf<"collage"> = {
  label: "",
  title: "",
  cell: "s",
  gap: "s",
  // Phones: three rows of two instead of six stacked bars.
  phone: "custom",
  bleed: false,
  tiles: [1000, 993, 986, 979, 972, 965].map((n, i) =>
    tile(
      `n${n}`,
      "text",
      { x: i * 2, y: 0, w: 2, h: 2 },
      {
        text: i === 0 ? `${n}` : `−7 → ${n}`,
        text_style: "heading",
        align: "center",
        fill: i === 0 ? "accent" : "surface",
        rounded: false,
        phone: { x: (i % 2) * 2, y: Math.floor(i / 2) * 2, w: 2, h: 2 },
      },
    ),
  ),
};

const sunsets: SettingsOf<"collage"> = {
  label: "Архив",
  title: "Закаты, которые я не удалил",
  cell: "m",
  gap: "s",
  phone: "auto",
  bleed: false,
  tiles: [
    photo("wires", "wires", { x: 0, y: 0, w: 7, h: 5 }, "Солнце садится за провода"),
    tile(
      "c993",
      "text",
      { x: 7, y: 0, w: 5, h: 2 },
      {
        text: "1000 − 7 = 993",
        text_style: "heading",
        fill: "accent",
        layer: 2,
      },
    ),
    photo("pylon", "pylon", { x: 7, y: 2, w: 3, h: 5 }, "Опора ЛЭП на фоне заката"),
    tile(
      "steps",
      "text",
      { x: 10, y: 2, w: 2, h: 5 },
      {
        text: countdown(993, 6).join("\n"),
        text_style: "label",
        fill: "surface",
      },
    ),
    tile(
      "quote",
      "text",
      { x: 0, y: 5, w: 4, h: 2 },
      {
        text: "я не грущу. я просто фотографирую закат.",
        text_style: "quote",
      },
    ),
    photo("lamp", "lamp", { x: 4, y: 5, w: 3, h: 3 }, "Фонарь загорается на закате", 2),
    photo("roofs", "roofs", { x: 0, y: 7, w: 4, h: 4 }, "Крыши и трубы в сумерках"),
    photo("city", "city", { x: 4, y: 8, w: 8, h: 3 }, "Город на закате"),
    photo("trees", "trees", { x: 7, y: 7, w: 5, h: 1 }, "Деревья на фоне неба", 0),
    tile(
      "more",
      "button",
      { x: 8, y: 11, w: 4, h: 1 },
      {
        link: { label: "Ещё 979 закатов", url: "https://t.me/zxc_993" },
        align: "right",
      },
    ),
  ],
};

const strip: SettingsOf<"carousel"> = {
  label: "18:47",
  title: "Сегодня, вчера, позавчера",
  items: (
    ["redlines", "clouds", "tall", "dusk", "field", "station", "sea", "windmills"] as const
  ).map((name) => ({ media: zxc(name), alt: "Закат", link: null })),
  mode: "marquee",
  autoplay: true,
  interval: 5,
  speed: 60,
  direction: "left",
  height: "l",
  pause_on_hover: true,
};

export const SAMPLE_ZXC_BLOCKS: AnyBlock[] = [
  {
    id: id(1),
    type: "hero",
    version: 1,
    hidden: false,
    settings: hero,
    appearance: look({ heading_font: "rubik-glitch" }),
  },
  {
    id: id(2),
    type: "collage",
    version: 1,
    hidden: false,
    settings: counter,
    appearance: look({ space: "s", heading_font: "rubik-glitch" }),
  },
  {
    id: COLLAGE_ID,
    type: "collage",
    version: 1,
    hidden: false,
    settings: sunsets,
    appearance: look({ divider: "line" }),
  },
  {
    id: id(4),
    type: "carousel",
    version: 1,
    hidden: false,
    settings: strip,
    appearance: look({ background: "pattern", pattern: "grid", divider: "line" }),
  },
  {
    id: id(5),
    type: "interests",
    version: 1,
    hidden: false,
    settings: {
      label: "Что держит в 3 ночи",
      items: ["закаты", "мид", "zxc", "1000 − 7", "ночные крыши", "наушники", "lo-fi", "чай"],
    },
    appearance: null,
  },
  {
    id: id(6),
    type: "contacts",
    version: 1,
    hidden: false,
    settings: {
      title: "Тоже не спишь?",
      title_muted: "Напиши в 18:47.",
      items: [
        { kind: "telegram", label: "Telegram", value: "@zxc_993", url: "https://t.me/zxc_993" },
        { kind: "email", label: "Почта", value: "993@example.com", url: "mailto:993@example.com" },
      ],
    },
    appearance: look({
      background: "image",
      image: zxc("redlines"),
      dim: 80,
      divider: "line",
      heading_font: "rubik-glitch",
    }),
  },
];

export const SAMPLE_ZXC_THEME = {
  accent: "#ff2a3d",
  second: "#e9edf3",
  style: "gothic" as const,
  heading_font: "dela-gothic" as const,
  body_font: "jetbrains" as const,
};
