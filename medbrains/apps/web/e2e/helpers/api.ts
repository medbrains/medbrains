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
import { getE2EIdentity } from "./e2e-identities";
import { provisionIdentity } from "./identities";
import type { ApiCallOptions, AuthContext } from "./types";

export const E2E_BACKEND_URL =
  process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; bodyText: string };
interface PublicApiOptions {
  expectStatus?: number | number[];
}

/** Login as admin and capture auth context (CSRF + user metadata). */
export async function loginAsAdmin(
  request: APIRequestContext,
): Promise<AuthContext> {
  // A super admin created for this call, not a credential read off disk.
  const admin = await provisionIdentity(request, "super_admin");
  return {
    csrfToken: admin.session.csrf,
    cookieHeader: admin.session.cookieHeader,
    request,
    userId: admin.session.user.id,
    tenantId: admin.session.user.tenant_id,
    password: admin.password,
  };
}

/** Login as a concrete E2E role and capture an isolated auth context. */
export async function loginAsRoleApi(
  request: APIRequestContext,
  role: string,
): Promise<AuthContext> {
  const identity = getE2EIdentity(role);
  const resp = await request.post(`${E2E_BACKEND_URL}/api/auth/login`, {
    data: { username: identity.username, password: identity.password },
  });
  expect(resp.status(), `${role} login expected 200, got ${resp.status()}`).toBe(200);
  const body = await resp.json();
  return {
    csrfToken: body.csrf_token ?? "",
    cookieHeader: cookieHeaderFromResponse(resp),
    request,
    userId: body.user?.id ?? "",
    tenantId: body.user?.tenant_id ?? "",
    password: identity.password,
  };
}


/**
 * Re-prove identity for a high-risk action.
 *
 * `POST /api/auth/step-up` mints a purpose-scoped, five-minute `step_up`
 * cookie. `require_step_up` at the top of a sensitive handler — prescription
 * sign, controlled-drug dispense, admin privilege change, clinical
 * break-glass — rejects with 403 `step_up_required` without it.
 *
 * Returns a context carrying the extra cookie. The original is left untouched,
 * so a caller can still assert the *unstepped* refusal, which is the more
 * important half of the control.
 */
export async function withStepUp(ctx: AuthContext): Promise<AuthContext> {
  if (!ctx.password) {
    throw new Error(
      "withStepUp needs the password this context logged in with; use loginAsRoleApi or loginAsAdmin",
    );
  }
  const resp = await ctx.request.post(`${E2E_BACKEND_URL}/api/auth/step-up`, {
    headers: {
      cookie: ctx.cookieHeader,
      "x-csrf-token": ctx.csrfToken,
      "content-type": "application/json",
    },
    data: { password: ctx.password },
  });
  expect(resp.status(), `step-up expected 200, got ${resp.status()}`).toBe(200);

  const minted = cookieHeaderFromResponse(resp);
  return {
    ...ctx,
    // Append rather than replace: the session cookie still has to travel with
    // it, or the request is unauthenticated and never reaches the step-up gate.
    cookieHeader: minted ? `${ctx.cookieHeader}; ${minted}` : ctx.cookieHeader,
  };
}

/**
 * Reuse the auth state already loaded into the request context via
 * `storageState: "e2e/.auth/user.json"`. Reads the existing `csrf_token`
 * cookie instead of paying the argon2 login round-trip.
 *
 * Falls back to a full `loginAsAdmin` if no csrf cookie is present (e.g.,
 * the spec runs in a project that doesn't load storageState).
 */
export async function getAuthContextFromCookies(
  request: APIRequestContext,
): Promise<AuthContext> {
  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name === "csrf_token")?.value ?? "";
  if (!csrf) return loginAsAdmin(request);
  const cookieHeader = cookieHeaderFromStorageState(state.cookies);
  const me = await request.get(`${E2E_BACKEND_URL}/api/auth/me`, {
    headers: { "x-csrf-token": csrf, cookie: cookieHeader },
  });
  if (!me.ok()) return loginAsAdmin(request);
  const body = await me.json().catch(() => ({}));
  const userId = body.user?.id ?? body.id ?? "";

  // storageState holds the session global-setup logged in with, so the
  // password is recoverable from the identity manifest — which matters because
  // high-risk actions need a step-up, and a context that cannot re-prove
  // identity cannot sign a prescription.
  //
  // Only when the recovered user *is* that identity: step-up verifies the
  // password against the current user, so attaching somebody else's would turn
  // a working session into a confusing 401.
  let password: string | undefined;
  try {
    const admin = getE2EIdentity("super_admin");
    if (admin.id && admin.id === userId) password = admin.password;
  } catch {
    // No manifest (a spec run outside the usual setup). Leave it unset and let
    // any step-up refusal surface honestly.
  }

  return {
    csrfToken: csrf,
    cookieHeader,
    request,
    userId,
    tenantId: body.user?.tenant_id ?? body.tenant_id ?? "",
    password,
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
  method: ApiMethod,
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

/** Make an unauthenticated public API call. */
export async function publicApi<T = unknown>(
  request: APIRequestContext,
  method: ApiMethod,
  path: string,
  body?: unknown,
  options: PublicApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";

  const resp = await request.fetch(`${E2E_BACKEND_URL}${path}`, {
    method,
    headers,
    data: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!statusOk(resp.status(), options.expectStatus)) {
    throw new Error(
      `${method} ${path} → ${resp.status()}\nbody: ${await resp.text()}`,
    );
  }
  if (resp.status() === 204) return undefined as T;
  const text = await resp.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Alias for unauthenticated machine-to-machine integration endpoints. */
export async function externalApi<T = unknown>(
  request: APIRequestContext,
  method: ApiMethod,
  path: string,
  body?: unknown,
  options: PublicApiOptions = {},
): Promise<T> {
  return publicApi<T>(request, method, path, body, options);
}

async function tryApi<T>(
  ctx: AuthContext,
  method: string,
  path: string,
  body: unknown,
  options: ApiCallOptions,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (ctx.cookieHeader) headers.cookie = ctx.cookieHeader;
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

function cookieHeaderFromResponse(resp: {
  headersArray: () => Array<{ name: string; value: string }>;
}): string {
  return resp
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function cookieHeaderFromStorageState(cookies: Array<{ name: string; value: string }>): string {
  return cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .filter(Boolean)
    .join("; ");
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
