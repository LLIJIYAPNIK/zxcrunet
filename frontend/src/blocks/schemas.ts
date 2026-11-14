/**
 * Block registry, server-safe part: zod schemas (mirror of backend
 * `sites/application/blocks.py`), defaults and library metadata.
 * Renders live in `renderers.tsx`, editors in `editors.tsx`.
 */
import { z } from "zod";

import type { IconName } from "@/components/ui/Icon";
import { PATTERNS } from "@/lib/theme/patterns";

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|tg:\/\/|#)[^\s<>"']*$/i;

const short = z.string().trim().max(80);
const line = z.string().trim().max(160);
const text = z.string().trim().max(1200);

export const linkSchema = z.object({
  label: short,
  url: z
    .string()
    .trim()
    .max(500)
    .regex(SAFE_URL, "Ссылка должна начинаться с https://, mailto:, tel:, tg:// или #"),
});
export type Link = z.infer<typeof linkSchema>;

export const mediaRefSchema = z.object({
  id: z.string().uuid(),
  url: z.string().regex(/^\/media\/[A-Za-z0-9/_.-]+$/),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
});
export type MediaRef = z.infer<typeof mediaRefSchema>;

export const heroSchema = z.object({
  label: short.default(""),
  title: line.min(1, "Введите заголовок"),
  lead: text.default(""),
  primary: linkSchema.nullable().default(null),
  secondary: linkSchema.nullable().default(null),
  card_name: short.default(""),
  card_role: short.default(""),
  avatar: mediaRefSchema.nullable().default(null),
  chips: z.array(short).max(6).default([]),
  pattern: z.enum(PATTERNS).default("rings"),
});

export const factsSchema = z.object({
  items: z
    .array(z.object({ value: z.string().trim().min(1, "Нужно значение").max(16), label: line }))
    .min(1)
    .max(10),
});

export const experienceSchema = z.object({
  label: short.default(""),
  title: line.default(""),
  items: z
    .array(
      z.object({
        title: short.min(1, "Введите название"),
        text: text.default(""),
        current: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(20),
});

export const projectsSchema = z.object({
  label: short.default(""),
  title: line.default(""),
  all_link: linkSchema.nullable().default(null),
  items: z
    .array(
      z.object({
        label: short.default(""),
        title: short.min(1, "Введите название"),
        text: text.default(""),
        tags: z.array(short).max(8).default([]),
        link: linkSchema.nullable().default(null),
      }),
    )
    .min(1)
    .max(12),
});

export const interestsSchema = z.object({
  label: short.default(""),
  items: z.array(short).min(1, "Добавьте хотя бы один тег").max(24),
});

export const GRADES = ["", "intern", "junior", "middle", "senior", "lead", "expert"] as const;
export type Grade = (typeof GRADES)[number];

export const stackSchema = z.object({
  label: short.default(""),
  title: line.default(""),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Введите навык").max(40),
        grade: z.enum(GRADES).default(""),
        /** Self-assessment for the progress bar; 0 hides the bar. */
        level: z.number().int().min(0).max(100).default(0),
        note: short.default(""),
      }),
    )
    .min(1, "Добавьте хотя бы один навык")
    .max(24),
});

export const CONTACT_KINDS = [
  "telegram",
  "github",
  "email",
  "phone",
  "vk",
  "linkedin",
  "website",
] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const contactsSchema = z.object({
  title: line.min(1, "Введите заголовок"),
  title_muted: short.default(""),
  items: z
    .array(
      z.object({
        kind: z.enum(CONTACT_KINDS),
        label: short,
        value: short.min(1, "Введите значение"),
        url: linkSchema.shape.url,
      }),
    )
    .min(1)
    .max(8),
});

export const resumeSchema = z.object({
  label: short.min(1, "Введите подпись"),
  /** null until the PDF is uploaded; such a block renders nothing. */
  file: mediaRefSchema.nullable().default(null),
});

// --- personal blocks: presentation only, the data comes from the owner's catalog ---------

export const TITLE_KINDS = ["game", "book", "anime", "series", "film"] as const;
const titleKind = z.enum(TITLE_KINDS);
const uuid = z.string().uuid();

export const profileSchema = z.object({
  cover: mediaRefSchema.nullable().default(null),
  avatar: mediaRefSchema.nullable().default(null),
  title: line.min(1, "Введите заголовок"),
  lead: text.default(""),
  mood: short.default(""),
  pattern: z.enum(PATTERNS).default("glow"),
});

export const nowSchema = z.object({
  label: short.default(""),
  kinds: z
    .array(titleKind)
    .min(1, "Выберите хотя бы одну полку")
    .max(5)
    .default([...TITLE_KINDS]),
  limit: z.number().int().min(1).max(6).default(3),
});

export const SHELF_STYLES = ["cards", "bento", "spines", "tickets", "tracker"] as const;
export type ShelfStyle = (typeof SHELF_STYLES)[number];

export const shelfSchema = z.object({
  kind: titleKind,
  style: z.enum(SHELF_STYLES).default("cards"),
  label: short.default(""),
  title: line.default(""),
  lead: text.default(""),
  controls: z.boolean().default(false),
  limit: z.number().int().min(1).max(60).default(12),
  all_link: linkSchema.nullable().default(null),
});

export const charactersSchema = z.object({
  label: short.default(""),
  title: line.default(""),
});

export const topSchema = z.object({
  label: short.default(""),
  title: line.default(""),
  items: z.array(uuid).min(1, "Выберите хотя бы один тайтл").max(10),
});

export const challengeSchema = z.object({
  label: short.default(""),
  kind: titleKind.default("book"),
  year: z.number().int().min(2000).max(2100),
  goal: z.number().int().min(1, "Цель — хотя бы 1").max(1000),
});

export const quotesSchema = z.object({
  label: short.default(""),
  title: line.default(""),
  items: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Введите цитату").max(1200),
        source: line.default(""),
        title_id: uuid.nullable().default(null),
      }),
    )
    .min(1)
    .max(20),
});

export const playlistSchema = z.object({
  label: short.default(""),
  title: line.default(""),
  lead: text.default(""),
  items: z
    .array(
      z.object({
        track: short.min(1, "Введите название трека"),
        artist: short.default(""),
        title_id: uuid.nullable().default(null),
        url: linkSchema.shape.url.nullable().default(null),
      }),
    )
    .min(1)
    .max(30),
});

export const postsSchema = z.object({
  label: short.default(""),
  title: line.default(""),
  kind: z.enum(["all", "review", "note"]).default("all"),
  limit: z.number().int().min(1).max(24).default(6),
});

export const SCHEMAS = {
  hero: heroSchema,
  facts: factsSchema,
  experience: experienceSchema,
  projects: projectsSchema,
  interests: interestsSchema,
  stack: stackSchema,
  contacts: contactsSchema,
  resume: resumeSchema,
  profile: profileSchema,
  now: nowSchema,
  shelf: shelfSchema,
  characters: charactersSchema,
  top: topSchema,
  challenge: challengeSchema,
  quotes: quotesSchema,
  playlist: playlistSchema,
  posts: postsSchema,
} as const;

export type BlockType = keyof typeof SCHEMAS;
export type SettingsOf<T extends BlockType> = z.infer<(typeof SCHEMAS)[T]>;

export type BlockData<T extends BlockType = BlockType> = {
  id: string;
  type: T;
  version: number;
  hidden: boolean;
  /** May be incomplete while the user is typing; validated before saving. */
  settings: SettingsOf<T>;
};

export type AnyBlock = { [T in BlockType]: BlockData<T> }[BlockType];

export type BlockMeta = {
  type: BlockType;
  title: string;
  description: string;
  icon: IconName;
  kinds: readonly ("business" | "personal")[];
  /** One-line summary for the block list in the editor. */
  summary: (settings: never) => string;
  /** Section label for the site's top navigation (single-page sites). */
  navLabel?: (settings: never) => string | null;
};

const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;
  return `${n} ${word}`;
};

export const META: { [T in BlockType]: BlockMeta & { type: T } } = {
  hero: {
    type: "hero",
    title: "Шапка",
    description: "Имя, роль, пара слов о себе, кнопки и карточка-визитка.",
    icon: "user",
    kinds: ["business", "personal"],
    summary: (s: SettingsOf<"hero">) => s.title || "имя, роль, аватар",
  },
  facts: {
    type: "facts",
    title: "Цифры",
    description: "От одного до десяти фактов крупными числами.",
    icon: "grid",
    kinds: ["business"],
    summary: (s: SettingsOf<"facts">) => plural(s.items.length, "факт", "факта", "фактов"),
  },
  experience: {
    type: "experience",
    title: "Опыт",
    description: "Где учились и работаете, текущее место подсвечено.",
    icon: "briefcase",
    kinds: ["business"],
    summary: (s: SettingsOf<"experience">) => plural(s.items.length, "место", "места", "мест"),
    navLabel: (s: SettingsOf<"experience">) => s.label || "Опыт",
  },
  projects: {
    type: "projects",
    title: "Проекты",
    description: "Карточки проектов со стеком и ссылкой.",
    icon: "layers",
    kinds: ["business"],
    summary: (s: SettingsOf<"projects">) =>
      plural(s.items.length, "карточка", "карточки", "карточек"),
    navLabel: (s: SettingsOf<"projects">) => s.label || "Проекты",
  },
  interests: {
    type: "interests",
    title: "Интересы",
    description: "Строка тегов: темы и увлечения.",
    icon: "shelf",
    kinds: ["business", "personal"],
    summary: (s: SettingsOf<"interests">) => plural(s.items.length, "тег", "тега", "тегов"),
  },
  stack: {
    type: "stack",
    title: "Стек",
    description: "Технологии с грейдом и шкалой владения.",
    icon: "layers",
    kinds: ["business"],
    summary: (s: SettingsOf<"stack">) => plural(s.items.length, "навык", "навыка", "навыков"),
    navLabel: (s: SettingsOf<"stack">) => s.label || "Стек",
  },
  contacts: {
    type: "contacts",
    title: "Контакты",
    description: "Telegram, GitHub, почта и другие способы связи.",
    icon: "send",
    kinds: ["business", "personal"],
    summary: (s: SettingsOf<"contacts">) => s.items.map((i) => i.label).join(", ") || "пусто",
    navLabel: () => "Контакты",
  },
  resume: {
    type: "resume",
    title: "Резюме PDF",
    description: "Ссылка на скачивание резюме.",
    icon: "link",
    kinds: ["business"],
    summary: (s: SettingsOf<"resume">) => s.label || "файл PDF",
  },
  profile: {
    type: "profile",
    title: "Шапка с обложкой",
    description: "Обложка, аватар, заголовок, пара слов о себе и статус настроения.",
    icon: "user",
    kinds: ["personal"],
    summary: (s: SettingsOf<"profile">) => s.title || "обложка и аватар",
  },
  now: {
    type: "now",
    title: "Сейчас",
    description: "Что играю, читаю и смотрю, с прогрессом. Берётся с полок.",
    icon: "eye",
    kinds: ["personal"],
    summary: (s: SettingsOf<"now">) => plural(s.limit, "карточка", "карточки", "карточек"),
  },
  shelf: {
    type: "shelf",
    title: "Полка",
    description: "Игры, книги, аниме, сериалы или фильмы: сетка, бенто, корешки, билеты, трекер.",
    icon: "shelf",
    kinds: ["personal"],
    summary: (s: SettingsOf<"shelf">) =>
      [KIND_TITLES[s.kind], STYLE_TITLES[s.style], s.controls ? "с фильтрами" : ""]
        .filter(Boolean)
        .join(" · "),
    navLabel: (s: SettingsOf<"shelf">) => s.title || KIND_TITLES[s.kind],
  },
  characters: {
    type: "characters",
    title: "Мои персонажи",
    description: "Любимые персонажи из всех вселенных, кольцами-аватарами.",
    icon: "heart",
    kinds: ["personal"],
    summary: () => "отмеченные в тайтлах",
  },
  top: {
    type: "top",
    title: "Личный топ",
    description: "Лучшее первым, с крупными номерами.",
    icon: "trophy",
    kinds: ["personal"],
    summary: (s: SettingsOf<"top">) => plural(s.items.length, "тайтл", "тайтла", "тайтлов"),
  },
  challenge: {
    type: "challenge",
    title: "Челлендж года",
    description: "Сколько прочитано или пройдено из плана, по месяцам.",
    icon: "check",
    kinds: ["personal"],
    summary: (s: SettingsOf<"challenge">) => `${s.year}: цель ${s.goal}`,
  },
  quotes: {
    type: "quotes",
    title: "Цитатник",
    description: "Цитаты с источником и ссылкой на тайтл.",
    icon: "quote",
    kinds: ["personal"],
    summary: (s: SettingsOf<"quotes">) => plural(s.items.length, "цитата", "цитаты", "цитат"),
  },
  playlist: {
    type: "playlist",
    title: "Плейлист",
    description: "Саундтреки со всех полок, каждый ведёт на свой тайтл.",
    icon: "music",
    kinds: ["personal"],
    summary: (s: SettingsOf<"playlist">) => plural(s.items.length, "трек", "трека", "треков"),
  },
  posts: {
    type: "posts",
    title: "Лента постов",
    description: "Рецензии и заметки; пост о тайтле показывает его карточку.",
    icon: "send",
    kinds: ["personal"],
    summary: (s: SettingsOf<"posts">) =>
      s.kind === "all" ? "все посты" : s.kind === "review" ? "рецензии" : "заметки",
    navLabel: (s: SettingsOf<"posts">) => s.title || "Посты",
  },
};

export const KIND_TITLES: Record<(typeof TITLE_KINDS)[number], string> = {
  game: "Игры",
  book: "Книги",
  anime: "Аниме",
  series: "Сериалы",
  film: "Фильмы",
};

export const STYLE_TITLES: Record<ShelfStyle, string> = {
  cards: "сетка карточек",
  bento: "бенто",
  spines: "корешки",
  tickets: "билеты",
  tracker: "трекер сезонов",
};

/** The style each shelf looks best in, as in the reference «Профиль · личное». */
export const STYLE_FOR_KIND: Record<(typeof TITLE_KINDS)[number], ShelfStyle> = {
  game: "bento",
  book: "spines",
  anime: "cards",
  series: "tracker",
  film: "tickets",
};

export const BLOCK_TYPES = Object.keys(META) as BlockType[];

/** Starting content for a freshly added block (already valid where possible). */
export function defaultSettings<T extends BlockType>(type: T, siteTitle: string): SettingsOf<T> {
  const defaults: { [K in BlockType]: unknown } = {
    hero: heroSchema.parse({
      title: siteTitle || "Ваше имя",
      card_name: siteTitle,
      primary: { label: "Написать", url: "#contacts" },
    }),
    facts: { items: [{ value: "5", label: "лет опыта" }] },
    experience: {
      label: "Опыт",
      title: "Где учился и работаю",
      items: [{ title: "Компания", text: "", current: true }],
    },
    projects: {
      label: "Проекты",
      title: "Что я сделал",
      all_link: null,
      items: [{ label: "", title: "Проект", text: "", tags: [], link: null }],
    },
    interests: { label: "Интересы", items: ["Дизайн"] },
    stack: {
      label: "Стек",
      title: "С чем работаю",
      items: [{ name: "Python", grade: "middle", level: 60, note: "" }],
    },
    contacts: {
      title: "Есть задача?",
      title_muted: "Напишите.",
      items: [
        { kind: "telegram", label: "Telegram", value: "@username", url: "https://t.me/username" },
      ],
    },
    resume: { label: "Скачать резюме в PDF", file: null },
    profile: profileSchema.parse({ title: siteTitle || "Обо мне" }),
    now: nowSchema.parse({}),
    shelf: shelfSchema.parse({ kind: "game", style: "bento", title: "Игры" }),
    characters: charactersSchema.parse({
      label: "Из всех вселенных сразу",
      title: "Мои персонажи",
    }),
    // Valid only once a title is picked: the editor shows the list right away.
    top: { label: "Личный топ", title: "Аниме", items: [] },
    challenge: challengeSchema.parse({
      label: "Челлендж года",
      year: new Date().getFullYear(),
      goal: 12,
    }),
    quotes: { label: "", title: "Цитатник", items: [{ text: "", source: "", title_id: null }] },
    playlist: {
      label: "Саундтреки со всех полок",
      title: "Плейлист",
      lead: "Каждый трек ведёт на свой тайтл.",
      items: [{ track: "", artist: "", title_id: null, url: null }],
    },
    posts: postsSchema.parse({ label: "Лента", title: "Посты" }),
  };
  return defaults[type] as SettingsOf<T>;
}

export function validateBlock(block: AnyBlock): z.ZodError | null {
  const result = SCHEMAS[block.type].safeParse(block.settings);
  return result.success ? null : result.error;
}

/** Anchor id of a block section: stable across renders, short in the URL. */
export function anchorId(block: Pick<AnyBlock, "id" | "type">): string {
  return block.type === "contacts" ? "contacts" : `b-${block.id.slice(-8)}`;
}
