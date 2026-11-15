/** Helpers of the admin panel: texts for codes, dates, paging. */
import type { AuditEntry } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

const t = ru.admin;

export const PAGE_SIZE = 50;

type ErrorCode = keyof typeof t.errors;

export function adminErrorText(code: string): string {
  return code in t.errors ? t.errors[code as ErrorCode] : t.errors.unknown;
}

type Action = keyof typeof t.audit.actions;

export function actionText(action: string): string {
  return action in t.audit.actions ? t.audit.actions[action as Action] : action;
}

/** The most telling detail of an audit entry: an email, a host, a slug, a reason. */
export function auditSubject(entry: AuditEntry): string {
  const d = entry.details as Record<string, unknown>;
  const subject = [d.email, d.host, d.slug, entry.target_type === "plan" ? entry.target_id : null]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .at(0);
  const reasons = t.reports.reason as Record<string, string>;
  const extra = [d.note, d.reason, d.plan]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => reasons[v] ?? v)
    .at(0);
  return [subject ?? entry.target_id, extra].filter(Boolean).join(" · ");
}

const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dayShort = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("ru", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : t.never;
}

/** `2026-11-15` → «15 нояб.» (days are UTC days on the server). */
export function formatDay(day: string, long = false): string {
  return (long ? dayLong : dayShort).format(new Date(`${day}T00:00:00Z`));
}

export function shownText(offset: number, count: number, total: number): string {
  if (total === 0) return t.empty;
  return t.shown
    .replace("{from}", String(offset + 1))
    .replace("{to}", String(offset + count))
    .replace("{total}", String(total));
}

/** Compact number for tiles: 1 234, 12,5 тыс. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("ru", {
    notation: value >= 100_000 ? "compact" : "standard",
  }).format(value);
}
