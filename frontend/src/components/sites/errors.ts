import { ru } from "@/i18n/ru";

type Code = keyof typeof ru.sites.errors;

export function siteErrorText(code: string): string {
  return code in ru.sites.errors ? ru.sites.errors[code as Code] : ru.sites.errors.unknown;
}
