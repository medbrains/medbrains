/**
 * Resolves the API base URL. In dev we read `EXPO_PUBLIC_API_BASE`
 * from app.json `extra` / build-time env; production builds bake a
 * tenant-specific URL via the EAS build profile.
 */

import { ExpoSecureStoreAdapter } from "@medbrains/mobile-shell";
import type { ApiConfig } from "./client.js";

const DEFAULT_BASE = "http://127.0.0.1:8080";

interface ProcessEnvShape {
  env?: Record<string, string | undefined>;
}

export function resolveApiBase(): string {
  const proc = (globalThis as { process?: ProcessEnvShape }).process;
  const fromEnv = proc?.env?.EXPO_PUBLIC_API_BASE;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_BASE;
}

export const apiConfig: ApiConfig = {
  baseUrl: resolveApiBase(),
  store: new ExpoSecureStoreAdapter(),
};
