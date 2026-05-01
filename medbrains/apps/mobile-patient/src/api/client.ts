/**
 * RN-friendly API client for the patient app. Reads the JWT (or
 * ABHA-derived token) out of the SecretStore on every request.
 *
 * Most patient-self-service endpoints live under `/api/portal/*` —
 * those are subject-locked at the backend (tenant + sub from the
 * JWT scope the response to the caller's own records). For
 * appointments/lab-reports/etc the staff endpoints aren't safe for
 * patient context; portal endpoints are the dedicated path.
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

export interface AuthResponse {
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

export async function loginWithPassword(
  config: ApiConfig,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request(config, "POST", "/api/auth/login", { username: email, password });
}
