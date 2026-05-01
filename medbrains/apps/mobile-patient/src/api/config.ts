/**
 * Resolves the patient API base URL. Patient apps point at the
 * tenant's public-facing portal hostname (eg `https://hospital.example.in`).
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
