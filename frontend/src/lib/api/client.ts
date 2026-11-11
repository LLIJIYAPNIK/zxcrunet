/**
 * Typed calls to the zxcrunet API. Types come only from the generated `schema.d.ts`
 * (`pnpm api:types`), never written by hand.
 */
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type User = Schemas["UserOut"];
export type Me = Schemas["MeOut"];

export type ApiErrorBody = {
  code: string;
  message: string;
  details: Record<string, unknown>;
};

export type ApiResult<T> =
  { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiErrorBody };

type PostPath = {
  [P in keyof paths]: paths[P] extends { post: unknown } ? P : never;
}[keyof paths];

type PostOperation<P extends PostPath> = paths[P] extends { post: infer Op } ? Op : never;

type RequestBody<P extends PostPath> =
  PostOperation<P> extends { requestBody: { content: { "application/json": infer B } } }
    ? B
    : undefined;

type SuccessBody<P extends PostPath> =
  PostOperation<P> extends { responses: infer R }
    ? R extends { 200: { content: { "application/json": infer B } } }
      ? B
      : R extends { 201: { content: { "application/json": infer B } } }
        ? B
        : null
    : null;

const NETWORK_ERROR: ApiErrorBody = { code: "network", message: "Network error", details: {} };

async function parse<T>(response: Response): Promise<ApiResult<T>> {
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

/** POST from the browser to the same-origin `/api` (cookies included automatically). */
export async function apiPost<P extends PostPath>(
  path: P,
  ...body: RequestBody<P> extends undefined ? [] : [RequestBody<P>]
): Promise<ApiResult<SuccessBody<P>>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: body.length ? { "Content-Type": "application/json" } : undefined,
      body: body.length ? JSON.stringify(body[0]) : undefined,
    });
    return await parse<SuccessBody<P>>(response);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}
