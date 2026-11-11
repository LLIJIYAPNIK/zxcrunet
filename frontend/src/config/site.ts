export const BRAND = "zxcrunet";

/** Domain shown in addresses: `name.zxc.ru.net`. */
export const SERVICE_DOMAIN = process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? "zxc.ru.net";

/**
 * How a site host becomes a link. Production: `https://{host}`.
 * Development: `http://{host}:3000`, where the host is `anna.localhost`.
 */
const SITE_URL_TEMPLATE = process.env.NEXT_PUBLIC_SITE_URL_TEMPLATE ?? "https://{host}";

/** Public address of a site on the service subdomain, e.g. `name.zxc.ru.net`. */
export function subdomainHost(slug: string, domain: string = SERVICE_DOMAIN): string {
  return `${slug}.${domain}`;
}

/** Link to a published site by the host the API reports (`anna.zxc.ru.net`). */
export function siteUrl(host: string, template: string = SITE_URL_TEMPLATE): string {
  return template.replace("{host}", host);
}

/** Address as people should read it: always on the service domain. */
export function displayAddress(slug: string): string {
  return subdomainHost(slug);
}
