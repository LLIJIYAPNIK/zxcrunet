/** Host handling shared by the proxy and tenant pages. Pure, so it is unit-tested. */

/** Hosts that serve the zxcrunet app itself; everything else is a user's site. */
export const DEFAULT_APP_HOSTS = ["zxc.ru.net", "www.zxc.ru.net", "localhost", "127.0.0.1"];

export function parseAppHosts(raw: string | undefined): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((h) => normalizeHost(h))
    .filter((h): h is string => Boolean(h));
  return list.length ? list : DEFAULT_APP_HOSTS;
}

/** `Anna.ZXC.ru.net:443.` → `anna.zxc.ru.net`; null for an empty or malformed header. */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = raw.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

export function isAppHost(host: string, appHosts: readonly string[]): boolean {
  return appHosts.includes(host);
}

/** Internal route a tenant request is rewritten to: `/tenant/<host>/<path>`. */
export function tenantPath(host: string, pathname: string): string {
  const rest = pathname === "/" ? "" : pathname;
  return `/tenant/${host}${rest}`;
}

export const TENANT_PREFIX = "/tenant";
