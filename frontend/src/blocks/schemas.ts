/**
 * Block registry, server-safe part: zod schemas (mirror of backend
 * `sites/application/blocks.py`), defaults and library metadata.
 * Renders live in `renderers.tsx`, editors in `editors.tsx`.
 */
import { z } from "zod";

import type { IconName } from "@/components/ui/Icon";

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
});

export const factsSchema = z.object({
  items: z
    .array(z.object({ value: z.string().trim().min(1, "Нужно значение").max(16), label: line }))
    .min(1)
    .max(4),
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

export const SCHEMAS = {
  hero: heroSchema,
  facts: factsSchema,
  experience: experienceSchema,
  projects: projectsSchema,
  interests: interestsSchema,
  contacts: contactsSchema,
  resume: resumeSchema,
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
    description: "До четырёх фактов крупными числами.",
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
    title: "Интересы и стек",
    description: "Строка тегов: технологии, темы, увлечения.",
    icon: "shelf",
    kinds: ["business", "personal"],
    summary: (s: SettingsOf<"interests">) => plural(s.items.length, "тег", "тега", "тегов"),
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
    contacts: {
      title: "Есть задача?",
      title_muted: "Напишите.",
      items: [
        { kind: "telegram", label: "Telegram", value: "@username", url: "https://t.me/username" },
      ],
    },
    resume: { label: "Скачать резюме в PDF", file: null },
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
