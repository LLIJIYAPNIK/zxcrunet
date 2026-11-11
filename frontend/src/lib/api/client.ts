/**
 * Typed calls to the zxcrunet API. Types come only from the generated `schema.d.ts`
 * (`pnpm api:types`), never written by hand.
 */
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type User = Schemas["UserOut"];
export type Me = Schemas["MeOut"];
export type SiteSummary = Schemas["SiteSummaryOut"];
export type Site = Schemas["SiteOut"];
export type SitePage = Schemas["PageOut"];
export type ResolvedSite = Schemas["ResolvedSiteOut"];

export type ApiErrorBody = {
  code: string;
  message: string;
  details: Record<string, unknown>;
};

export type ApiResult<T> =
  { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiErrorBody };

type Method = "get" | "post" | "put" | "patch" | "delete";

type PathFor<M extends Method> = {
  [P in keyof paths]: paths[P] extends Record<M, infer Op>
    ? Op extends object
      ? P
      : never
    : never;
}[keyof paths];

type Operation<M extends Method, P extends PathFor<M>> = paths[P][M];

type JsonOf<T> = T extends { content: { "application/json": infer B } } ? B : null;

type SuccessBody<Op> = Op extends { responses: infer R }
  ? R extends { 200: infer S }
    ? JsonOf<S>
    : R extends { 201: infer S }
      ? JsonOf<S>
      : null
  : null;

type Options<Op> = (Op extends { parameters: { path: infer PP } }
  ? PP extends Record<string, unknown>
    ? { path: PP }
    : { path?: never }
  : { path?: never }) &
  (Op extends { parameters: { query?: infer Q } }
    ? Q extends Record<string, unknown>
      ? { query?: Q }
      : { query?: never }
    : { query?: never }) &
  (Op extends { requestBody: { content: { "application/json": infer B } } }
    ? { body: B }
    : { body?: never });

type OptionalArg<Op> = keyof Options<Op> extends never
  ? []
  : Options<Op> extends { path: unknown } | { body: unknown }
    ? [Options<Op>]
    : [Options<Op>?];

const NETWORK_ERROR: ApiErrorBody = { code: "network", message: "Network error", details: {} };

/** Fills `{param}` placeholders and appends the query string. */
export function buildUrl(
  template: string,
  path?: Record<string, unknown>,
  query?: Record<string, unknown>,
): string {
  const url = template.replace(/\{(\w+)\}/g, (_, name: string) =>
    encodeURIComponent(String(path?.[name] ?? "")),
  );
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : null;
  if (response.ok) return { ok: true, status: response.status, data: json as T };
  const error = (json as { error?: ApiErrorBody } | null)?.error;
  return {
    ok: false,
    status: response.status,
    error: error ?? { code: "unknown", message: response.statusText, details: {} },
  };
}

async function call<M extends Method, P extends PathFor<M>>(
  method: M,
  path: P,
  options?: { path?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown },
): Promise<ApiResult<SuccessBody<Operation<M, P>>>> {
  const hasBody = options?.body !== undefined;
  try {
    const response = await fetch(buildUrl(path, options?.path, options?.query), {
      method: method.toUpperCase(),
      credentials: "same-origin",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options?.body) : undefined,
    });
    return await parseResponse(response);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}

/** Browser → same-origin `/api` (the session cookie goes along automatically). */
export const api = {
  get: <P extends PathFor<"get">>(path: P, ...opts: OptionalArg<Operation<"get", P>>) =>
    call("get", path, opts[0] as Parameters<typeof call>[2]),
  post: <P extends PathFor<"post">>(path: P, ...opts: OptionalArg<Operation<"post", P>>) =>
    call("post", path, opts[0] as Parameters<typeof call>[2]),
  put: <P extends PathFor<"put">>(path: P, ...opts: OptionalArg<Operation<"put", P>>) =>
    call("put", path, opts[0] as Parameters<typeof call>[2]),
  patch: <P extends PathFor<"patch">>(path: P, ...opts: OptionalArg<Operation<"patch", P>>) =>
    call("patch", path, opts[0] as Parameters<typeof call>[2]),
  delete: <P extends PathFor<"delete">>(path: P, ...opts: OptionalArg<Operation<"delete", P>>) =>
    call("delete", path, opts[0] as Parameters<typeof call>[2]),
};

/** Kept for the auth forms: POST with an optional JSON body. */
export function apiPost<P extends PathFor<"post">>(
  path: P,
  ...body: Operation<"post", P> extends {
    requestBody: { content: { "application/json": infer B } };
  }
    ? [B]
    : []
) {
  return call("post", path, body.length ? { body: body[0] } : undefined);
}
