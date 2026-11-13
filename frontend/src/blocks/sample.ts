/**
 * A business card built like the reference «Профиль · бизнес» (fictional person).
 * Used by the component showcase (/ui/sample), unit tests and as a template idea.
 */
import type { AnyBlock } from "./schemas";

const id = (n: number) => `0195f3a0-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const SAMPLE_BUSINESS_BLOCKS: AnyBlock[] = [
  {
    id: id(1),
    type: "hero",
    version: 1,
    hidden: false,
    settings: {
      label: "Продуктовый дизайн · UX",
      title: "Анна Волкова, продуктовый дизайнер интерфейсов",
      lead: "Проектирую сервисы, которыми удобно пользоваться с первого раза. Люблю исследования, дизайн-системы и аккуратные прототипы. Веду курс по UX в онлайн-школе.",
      primary: { label: "Написать в Telegram", url: "https://t.me/anna_volkova_design" },
      secondary: { label: "Смотреть проекты", url: "#b-00000004" },
      card_name: "Анна Волкова",
      card_role: "Product / UX дизайнер",
      avatar: null,
      chips: ["Figma", "UX", "Research"],
      pattern: "rings",
    },
  },
  {
    id: id(2),
    type: "facts",
    version: 1,
    hidden: false,
    settings: {
      items: [
        { value: "7 лет", label: "в продуктовом дизайне" },
        { value: "40+", label: "интервью с пользователями в год" },
        { value: "3", label: "дизайн-системы с нуля" },
        { value: "1 раз", label: "выступала на конференции в костюме котика" },
      ],
    },
  },
  {
    id: id(3),
    type: "experience",
    version: 1,
    hidden: false,
    settings: {
      label: "Опыт",
      title: "Где училась и работаю",
      items: [
        {
          title: "Студия «Север»",
          text: "Ведущий дизайнер: веб-сервисы для банков и ритейла.",
          current: true,
        },
        {
          title: "Онлайн-школа «Курсор»",
          text: "Автор и преподаватель курса по UX.",
          current: false,
        },
        { title: "ВШЭ, дизайн", text: "Бакалавриат по коммуникационному дизайну.", current: false },
      ],
    },
  },
  {
    id: id(4),
    type: "projects",
    version: 1,
    hidden: false,
    settings: {
      label: "Проекты",
      title: "Работы, которые можно открыть",
      all_link: { label: "Все работы на Behance", url: "https://www.behance.net/" },
      items: [
        {
          label: "Финтех",
          title: "Мобильный банк",
          text: "Переделали перевод по номеру телефона: на 30% меньше ошибок и обращений в поддержку.",
          tags: ["Figma", "Прототипы", "A/B"],
          link: { label: "Открыть кейс", url: "https://www.behance.net/" },
        },
        {
          label: "Дизайн-система",
          title: "Kit «Север»",
          text: "Компоненты, токены и документация для пяти продуктовых команд.",
          tags: ["Tokens", "Storybook"],
          link: { label: "Открыть на GitHub", url: "https://github.com/" },
        },
        {
          label: "Пет-проект",
          title: "Трекер привычек",
          text: "Маленькое приложение без лишних экранов.",
          tags: ["iOS", "SwiftUI"],
          link: null,
        },
      ],
    },
  },
  {
    id: id(5),
    type: "interests",
    version: 1,
    hidden: false,
    settings: {
      label: "Интересы",
      items: ["Дизайн-системы", "UX-исследования", "Доступность", "Типографика"],
    },
  },
  {
    id: id(6),
    type: "contacts",
    version: 1,
    hidden: false,
    settings: {
      title: "Есть задача?",
      title_muted: "Напишите.",
      items: [
        {
          kind: "telegram",
          label: "Telegram",
          value: "@anna_volkova_design",
          url: "https://t.me/anna_volkova_design",
        },
        { kind: "github", label: "GitHub", value: "anna-volkova", url: "https://github.com/" },
        {
          kind: "email",
          label: "Почта",
          value: "anna@example.com",
          url: "mailto:anna@example.com",
        },
      ],
    },
  },
];
