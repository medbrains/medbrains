/**
 * RN-friendly API client. The shared `@medbrains/api` is browser-only
 * (uses `window.sessionStorage` + `document.cookie` for CSRF), so the
 * staff app ships its own minimal fetch wrapper that reads the JWT
 * out of the `SecretStore` configured by the shell.
 *
 * Backend wire shape is the same — every method here corresponds to
 * a route in `crates/medbrains-server/src/routes/`.
 */

import type { SecretStore } from "@medbrains/mobile-shell";
import { SECRET_KEYS } from "@medbrains/mobile-shell";

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
  };
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const payload = text ? safeParse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : res.statusText,
      payload,
    );
  }
  return payload as T;
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
    role: string | null;
    permissions: string[];
    department_ids: string[];
  };
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
