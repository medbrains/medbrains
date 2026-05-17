/**
 * RN-friendly API client. The shared `@medbrains/api` is browser-only
 * (uses `window.sessionStorage` + `document.cookie` for CSRF), so the
 * camp app ships its own minimal fetch wrapper that reads the JWT
 * out of the `SecretStore` configured by the shell.
 *
 * Backend wire shape is the same — every method here corresponds to
 * a route in `crates/medbrains-server/src/routes/`.
 */

import type { SecretStore } from "@medbrains/mobile-shell";
import { SECRET_KEYS, useAuthStore } from "@medbrains/mobile-shell";

export interface ApiConfig {
  baseUrl: string;
  store: SecretStore;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let csrfToken: string | null = null;

export async function request<T>(
  config: ApiConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const jwt = await config.store.getItem(SECRET_KEYS.jwt);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-MedBrains-Client": "mobile-camp",
  };
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }
  if (MUTATION_METHODS.has(method.toUpperCase()) && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const payload = text ? safeParse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) {
      await useAuthStore.getState().signOut(config.store);
    }
    throw new ApiError(
      res.status,
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : res.statusText,
      payload,
    );
  }
  rememberCsrfToken(payload);
  return payload as T;
}

function rememberCsrfToken(payload: unknown): void {
  if (!payload || typeof payload !== "object" || !("csrf_token" in payload)) {
    return;
  }
  const value = (payload as { csrf_token?: unknown }).csrf_token;
  csrfToken = typeof value === "string" && value.length > 0 ? value : null;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export interface LoginResponse {
  token: string;
  refresh_token?: string;
  user: {
    id: string;
    tenant_id: string;
    username: string;
    email: string;
    full_name: string;
    role: string | null;
  };
  permissions: string[];
  department_ids: string[];
}

export async function login(
  config: ApiConfig,
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  return request(config, "POST", "/api/auth/login", {
    username: identifier,
    password,
  });
}

export async function fetchMe(config: ApiConfig): Promise<LoginResponse["user"]> {
  return request(config, "GET", "/api/auth/me");
}
