export const DESKTOP_API_BASE_STORAGE_KEY = "medbrains_desktop_api_base";

export function isTauriDesktopRuntime(): boolean {
  return "__TAURI_INTERNALS__" in globalThis;
}

export function getStoredDesktopApiBase(): string | null {
  try {
    return window.localStorage.getItem(DESKTOP_API_BASE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredDesktopApiBase(apiBase: string | null): void {
  try {
    if (apiBase) {
      window.localStorage.setItem(DESKTOP_API_BASE_STORAGE_KEY, apiBase);
    } else {
      window.localStorage.removeItem(DESKTOP_API_BASE_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable in hardened desktop profiles.
  }
}

export function normalizeDesktopApiBase(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed === "/api") return trimmed;
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export function defaultDesktopApiBase(): string {
  return "https://medbrains.localhost/api";
}
