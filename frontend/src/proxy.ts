/**
 * Multi-tenant routing by Host.
 * - zxcrunet's own hosts (APP_HOSTS) serve the app; `/tenant/*` is hidden there.
 * - Any other host is a user's site: it is resolved through the API and rewritten to
 *   `/tenant/<host>/<path>`, or answered here with a real 404 / 403 / 503 stub.
 */
import { NextResponse, type NextRequest } from "next/server";

import { SERVICE_DOMAIN } from "@/config/site";
import { ru } from "@/i18n/ru";
import {
  TENANT_PREFIX,
  isAppHost,
  normalizeHost,
  parseAppHosts,
  tenantPath,
} from "@/lib/tenant/hosts";
import { stubResponse } from "@/lib/tenant/stub";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const APP_HOSTS = parseAppHosts(process.env.APP_HOSTS);

type Resolution = "published" | "suspended" | "missing" | "error";

async function resolve(host: string): Promise<Resolution> {
  try {
    const response = await fetch(
      `${API_INTERNAL_URL}/api/public/sites/resolve?host=${encodeURIComponent(host)}`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (response.status === 404) return "missing";
    if (!response.ok) return "error";
    const body = (await response.json()) as { status: "published" | "suspended" };
    return body.status;
  } catch {
    return "error";
  }
}

export async function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;
  const t = ru.publicSite;

  if (!host || isAppHost(host, APP_HOSTS)) {
    if (pathname === TENANT_PREFIX || pathname.startsWith(`${TENANT_PREFIX}/`)) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  const state = await resolve(host);
  if (state === "missing") {
    return stubResponse({
      status: 404,
      title: t.missingTitle,
      lead: t.missingLead,
      cta: { label: t.missingCta, href: `https://${SERVICE_DOMAIN}` },
    });
  }
  if (state === "suspended") {
    return stubResponse({ status: 403, title: t.suspendedTitle, lead: t.suspendedLead });
  }
  if (state === "error") {
    return stubResponse({ status: 503, title: t.suspendedTitle, lead: ru.auth.errors.unknown });
  }

  const url = request.nextUrl.clone();
  url.pathname = tenantPath(host, pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|media|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
