import type { ResolvedSite } from "@/lib/api/client";
import { API_INTERNAL_URL } from "@/lib/auth/session";

/** Published content for a host; the API caches it in Redis. */
export async function resolveSite(host: string): Promise<ResolvedSite | null> {
  const response = await fetch(
    `${API_INTERNAL_URL}/api/public/sites/resolve?host=${encodeURIComponent(host)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`resolve ${host} failed: ${response.status}`);
  return (await response.json()) as ResolvedSite;
}
