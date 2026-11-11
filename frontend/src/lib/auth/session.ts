/**
 * Server-side access to the API on behalf of the signed-in user (Data Access Layer).
 * Reads the session cookie, so call these only inside a <Suspense> boundary (Cache Components).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Me } from "@/lib/api/client";

export const SESSION_COOKIE = "zxc_session";
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

export type ServerResult<T> = { status: number; data: T | null };

/** GET `path` from the API with the user's session cookie forwarded. */
export async function serverGet<T>(path: string): Promise<ServerResult<T>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { status: 401, data: null };
  const response = await fetch(`${API_INTERNAL_URL}${path}`, {
    headers: { Cookie: `${SESSION_COOKIE}=${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status >= 500) throw new Error(`${path} failed: ${response.status}`);
    return { status: response.status, data: null };
  }
  return { status: response.status, data: (await response.json()) as T };
}

/** The signed-in user with plan limits, or null when there is no valid session. */
export async function getMe(): Promise<Me | null> {
  return (await serverGet<Me>("/api/auth/me")).data;
}

export async function requireMe(next = "/app"): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/app/login?next=${encodeURIComponent(next)}`);
  return me;
}

/** GET on behalf of the user; redirects to login on 401/403, returns null on 404. */
export async function requireData<T>(path: string, next: string): Promise<T | null> {
  const result = await serverGet<T>(path);
  if (result.status === 401 || result.status === 403) {
    redirect(`/app/login?next=${encodeURIComponent(next)}`);
  }
  return result.data;
}
