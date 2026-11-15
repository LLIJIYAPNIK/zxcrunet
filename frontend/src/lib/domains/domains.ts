/** Custom domains in the cabinet: texts for DNS problems and record names for registrars. */
import type { CustomDomain, SiteDomains } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

type Problem = CustomDomain["problems"][number];
type Server = SiteDomains["server"];

const t = ru.sites.domains;

/** Second-level zones people buy names in: `anna.co.uk` is a whole domain. */
const TWO_LEVEL_ZONES = new Set([
  "co.uk",
  "org.uk",
  "com.ru",
  "net.ru",
  "org.ru",
  "msk.ru",
  "spb.ru",
  "com.ua",
  "com.kz",
  "co.il",
  "com.au",
  "com.br",
  "com.tr",
]);

/** The registered domain a host belongs to: `www.anna.co.uk` → `anna.co.uk`. */
export function registeredZone(host: string): string {
  const labels = host.split(".");
  const lastTwo = labels.slice(-2).join(".");
  return labels.slice(TWO_LEVEL_ZONES.has(lastTwo) ? -3 : -2).join(".");
}

/** What many registrar panels want in the «name» field: `@`, `www`, `_zxc-verify`. */
export function shortName(name: string, zone: string): string {
  if (name === zone) return "@";
  return name.endsWith(`.${zone}`) ? name.slice(0, -zone.length - 1) : name;
}

const isActive = (status: CustomDomain["status"]) => status === "active" || status === "verified";

/** Domains whose state may change soon on its own (the page refreshes them). */
export function inProgress(domains: readonly CustomDomain[]): boolean {
  return domains.some((d) => d.status === "pending" || d.status === "verified");
}

export function isServing(domain: CustomDomain): boolean {
  return isActive(domain.status);
}

function found(problem: Problem): string {
  const values = problem.details.found;
  return Array.isArray(values) && values.length ? values.join(", ") : "—";
}

export function problemText(problem: Problem, domain: CustomDomain, server: Server): string {
  const texts = t.problems;
  const txt = domain.records.find((r) => r.type === "TXT");
  const fill = (text: string) =>
    text
      .replace("{name}", txt?.name ?? `_zxc-verify.${domain.host}`)
      .replace("{host}", domain.host)
      .replace("{found}", found(problem))
      .replace("{expected}", server.ipv4.join(", "));
  switch (problem.code) {
    case "txt_missing":
    case "txt_mismatch":
    case "a_missing":
    case "a_wrong":
    case "aaaa_wrong":
    case "domain_taken":
    case "dns_unavailable":
      return fill(texts[problem.code]);
    default:
      return texts.unknown;
  }
}

const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
