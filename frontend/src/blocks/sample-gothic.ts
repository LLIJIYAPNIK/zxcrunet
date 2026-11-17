/**
 * A gothic card (fictional illustrator): fullscreen hero over a fog loop, a collage,
 * a running strip, section backgrounds, ornaments and per-section fonts.
 * Used by /ui/sample/gothic and `pnpm seed:demo`, which uploads the files and swaps
 * the `/demo/…` addresses below for real `/media/…` ones.
 */
// Types only: the demo seed imports this file with Node's type stripping (no bundler).
import type { Appearance, AnyBlock, MediaRef, Place, SettingsOf, Tile } from "./schemas";

/** Pictures and the fog clip in public/demo (made by scripts/make-demo-media.py). */
export const DEMO_FILES = {
  moon: { file: "moon.webp", width: 1600, height: 1000 },
  candles: { file: "candles.webp", width: 1200, height: 900 },
  rose: { file: "rose.webp", width: 1000, height: 1000 },
  arches: { file: "arches.webp", width: 1200, height: 900 },
  forest: { file: "forest.webp", width: 1200, height: 900 },
  ink: { file: "ink.webp", width: 900, height: 1200 },
  fog: { file: "fog.mp4", width: null, height: null },
} as const;

export type DemoName = keyof typeof DEMO_FILES;

const id = (n: number) => `0196a000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const DEMO_IDS = Object.fromEntries(
  Object.keys(DEMO_FILES).map((name, i) => [name, id(100 + i)]),
) as Record<DemoName, string>;

export function demo(name: DemoName): MediaRef {
  const { file, width, height } = DEMO_FILES[name];
  return { id: DEMO_IDS[name], url: `/demo/${file}`, width, height };
}

/** Same as `DEFAULT_APPEARANCE` (a test keeps them equal). */
export const LOOK_BASE: Appearance = {
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

const look = (patch: Partial<Appearance>): Appearance => ({ ...LOOK_BASE, ...patch });

function tile(id: string, kind: Tile["kind"], desktop: Place, extra: Partial<Tile> = {}): Tile {
  return {
    id,
    kind,
    media: null,
    embed: null,
    text: "",
    text_style: "body",
    text_font: null,
    text_size: null,
    text_color: null,
    align: "left",
    link: null,
    fill: "none",
    fit: "cover",
    rounded: true,
    alt: "",
    desktop,
    phone: null,
    layer: 1,
    ...extra,
  };
}

const hero: SettingsOf<"hero"> = {
  label: "Иллюстрация · тату · леттеринг",
  title: "Мира Чернова рисует то, что снится после полуночи",
  lead: "Готические иллюстрации, эскизы татуировок и леттеринг для обложек, мерча и книг. Работаю с издательствами, музыкантами и смелыми людьми.",
  primary: { label: "Заказать эскиз", url: "https://t.me/mira_noir" },
  secondary: { label: "Смотреть работы", url: "#b-000000aa" },
  card_name: "",
  card_role: "",
  avatar: null,
  chips: [],
  pattern: "none",
  layout: "fullscreen",
  media: [],
  background: demo("fog"),
  dim: 25,
  align: "center",
};

const collage: SettingsOf<"collage"> = {
  label: "Избранное",
  title: "Ночные работы",
  cell: "m",
  gap: "s",
  phone: "auto",
  bleed: false,
  tiles: [
    tile(
      "moon",
      "image",
      { x: 0, y: 0, w: 7, h: 5 },
      { media: demo("moon"), alt: "Собор под луной" },
    ),
    tile(
      "rose",
      "image",
      { x: 7, y: 0, w: 5, h: 4 },
      {
        media: demo("rose"),
        alt: "Витражная роза",
        layer: 2,
      },
    ),
    tile(
      "quote",
      "text",
      { x: 7, y: 4, w: 5, h: 2 },
      {
        text: "«Тьма — это просто холст, на котором видно свет».",
        text_style: "quote",
        fill: "surface",
        layer: 3,
      },
    ),
    tile("candles", "image", { x: 0, y: 5, w: 4, h: 4 }, { media: demo("candles"), alt: "Свечи" }),
    tile("ink", "image", { x: 4, y: 5, w: 3, h: 4 }, { media: demo("ink"), alt: "Эскиз-оберег" }),
    tile(
      "forest",
      "image",
      { x: 7, y: 6, w: 5, h: 3 },
      {
        media: demo("forest"),
        alt: "Лес и вороны на закате",
      },
    ),
    tile(
      "cta",
      "button",
      { x: 7, y: 9, w: 5, h: 1 },
      {
        link: { label: "Все работы на Behance", url: "https://www.behance.net/" },
        align: "right",
      },
    ),
  ],
};

const strip: SettingsOf<"carousel"> = {
  label: "Флэш",
  title: "Свободные эскизы",
  mode: "marquee",
  autoplay: true,
  interval: 5,
  speed: 50,
  direction: "left",
  height: "m",
  pause_on_hover: true,
  items: (["arches", "forest", "moon", "candles", "rose", "ink"] as const).map((name) => ({
    media: demo(name),
    alt: "",
    link: null,
  })),
};

export const SAMPLE_GOTHIC_BLOCKS: AnyBlock[] = [
  { id: id(1), type: "hero", version: 1, hidden: false, settings: hero, appearance: null },
  {
    id: id(2),
    type: "facts",
    version: 1,
    hidden: false,
    settings: {
      items: [
        { value: "9 лет", label: "рисую тушью и пером" },
        { value: "300+", label: "эскизов ушли в кожу" },
        { value: "14", label: "обложек для групп и книг" },
      ],
    },
    appearance: look({ background: "surface", space: "s" }),
  },
  {
    id: "0196a000-0000-7000-8000-0000000000aa",
    type: "collage",
    version: 1,
    hidden: false,
    settings: collage,
    appearance: look({ divider: "ornament" }),
  },
  {
    id: id(4),
    type: "carousel",
    version: 1,
    hidden: false,
    settings: strip,
    appearance: look({ background: "pattern", pattern: "arches", divider: "ornament" }),
  },
  {
    id: id(5),
    type: "contacts",
    version: 1,
    hidden: false,
    settings: {
      title: "Есть идея?",
      title_muted: "Расскажите её ночью.",
      items: [
        {
          kind: "telegram",
          label: "Telegram",
          value: "@mira_noir",
          url: "https://t.me/mira_noir",
        },
        {
          kind: "email",
          label: "Почта",
          value: "mira@example.com",
          url: "mailto:mira@example.com",
        },
      ],
    },
    appearance: look({
      background: "gradient",
      color: "#16080c",
      color2: "#040203",
      angle: 160,
      divider: "ornament",
      heading_font: "monomakh",
    }),
  },
];

export const SAMPLE_GOTHIC_THEME = {
  accent: "#f0283f",
  second: "#d4af37",
  style: "gothic" as const,
  heading_font: "" as const,
  body_font: "" as const,
};
