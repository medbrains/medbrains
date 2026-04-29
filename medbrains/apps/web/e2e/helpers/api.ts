/**
 * Typed REST client for E2E specs.
 *
 * - Logs in once, captures CSRF + cookies (cookies are auto-stored on the
 *   request context).
 * - Self-healing: on 4xx/5xx with `variants` provided, retries the call
 *   against each variant path before throwing.
 * - Throws an Error with full method + path + status + body on hard failure.
 */

import { expect, type APIRequestContext } from "@playwright/test";
import type { ApiCallOptions, AuthContext } from "./types";

export const E2E_BACKEND_URL =
  process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

export const ADMIN_USERNAME = process.env.E2E_ADMIN_USER ?? "admin";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASS ?? "admin123";

/** Login as admin and capture auth context (CSRF + user metadata). */
export async function loginAsAdmin(
  request: APIRequestContext,
): Promise<AuthContext> {
  const resp = await request.post(`${E2E_BACKEND_URL}/api/auth/login`, {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  expect(resp.status(), `login expected 200, got ${resp.status()}`).toBe(200);
  const body = await resp.json();
  return {
    csrfToken: body.csrf_token ?? "",
    request,
    userId: body.user?.id ?? "",
    tenantId: body.user?.tenant_id ?? "",
  };
}

function statusOk(status: number, expected?: number | number[]): boolean {
  if (expected === undefined) return status >= 200 && status < 300;
  if (Array.isArray(expected)) return expected.includes(status);
  return status === expected;
}

/**
 * Make an authenticated REST call. On non-OK status, log diagnostics
 * and throw an Error with method + path + status + body.
 */
export async function api<T = unknown>(
  ctx: AuthContext,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: ApiCallOptions = {},
): Promise<T> {
  const result = await tryApi<T>(ctx, method, path, body, options);
  if (result.ok) return result.data;

  if (options.variants && options.variants.length > 0) {
    for (const variant of options.variants) {
      const r = await tryApi<T>(ctx, method, variant, body, options);
      if (r.ok) {
        // eslint-disable-next-line no-console
        console.warn(
          `[e2e/api] ${method} ${path} failed; variant ${variant} succeeded — update the spec`,
        );
        return r.data;
      }
    }
  }

  throw new Error(
    `${method} ${path} → ${result.status}\nbody: ${result.bodyText}` +
      (options.variants
        ? `\nvariants tried: ${options.variants.join(", ")}`
        : ""),
  );
}

async function tryApi<T>(
  ctx: AuthContext,
  method: string,
  path: string,
  body: unknown,
  options: ApiCallOptions,
): Promise<{ ok: true; data: T } | { ok: false; status: number; bodyText: string }> {
  const headers: Record<string, string> = {};
  if (!options.skipCsrf) headers["x-csrf-token"] = ctx.csrfToken;
  if (body !== undefined) headers["content-type"] = "application/json";

  const resp = await ctx.request.fetch(`${E2E_BACKEND_URL}${path}`, {
    method,
    headers,
    data: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!statusOk(resp.status(), options.expectStatus)) {
    const bodyText = await resp.text();
    return { ok: false, status: resp.status(), bodyText };
  }
  if (resp.status() === 204) return { ok: true, data: undefined as T };
  const text = await resp.text();
  if (!text) return { ok: true, data: undefined as T };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: true, data: text as unknown as T };
  }
}

/** Build a query string from an object, dropping undefined/null. */
export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
