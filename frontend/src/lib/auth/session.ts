/**
 * Server-side access to the current user (Data Access Layer).
 * Reads the session cookie, so call it only inside a <Suspense> boundary (Cache Components).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Me } from "@/lib/api/client";

export const SESSION_COOKIE = "zxc_session";
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

/** The signed-in user with plan limits, or null when there is no valid session. */
export async function getMe(): Promise<Me | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const response = await fetch(`${API_INTERNAL_URL}/api/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE}=${token}` },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`/api/auth/me failed: ${response.status}`);
  return (await response.json()) as Me;
}

export async function requireMe(next = "/app"): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/app/login?next=${encodeURIComponent(next)}`);
  return me;
}
