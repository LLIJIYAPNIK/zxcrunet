/** Все тексты интерфейса. Новые строки добавляем сюда, а не в разметку. */
export const ru = {
  meta: {
    description: "Сайты-визитки: рабочая и личная, на поддомене zxc.ru.net или на своём домене.",
  },
  home: {
    tagline: "Визитка, которая светится",
    lead: "Соберите визитку из готовых блоков и опубликуйте её по адресу",
    addressPlaceholder: "имя",
    soon: "Скоро открытие",
  },
  footer: {
    madeWith: "Сделано на",
  },
} as const;

export type Dictionary = typeof ru;
