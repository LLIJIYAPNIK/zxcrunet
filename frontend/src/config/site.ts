export const BRAND = "zxcrunet";

export const SERVICE_DOMAIN = process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? "zxc.ru.net";

/** Public address of a site on the service subdomain, e.g. `name.zxc.ru.net`. */
export function subdomainHost(slug: string, domain: string = SERVICE_DOMAIN): string {
  return `${slug}.${domain}`;
}
