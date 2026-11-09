// OS keyring-backed secure storage on the desktop (Tauri) — macOS Keychain,
// Windows Credential Manager, Linux Secret Service (libsecret/D-Bus), via the
// keyring_* commands in apps/desktop. On the web there is no Tauri, so these are
// no-ops: the browser session lives in HttpOnly cookies instead. Use this for
// the session / SSO access token on desktop so it never sits in localStorage.

import { desktopInvoke, isTauriDesktopRuntime } from "./desktop-runtime";

export const secureStore = {
  isAvailable: isTauriDesktopRuntime,

  /** Store an opaque secret (e.g. the access token) under `key` in the OS keyring. */
  async set(key: string, value: string): Promise<void> {
    if (isTauriDesktopRuntime()) await desktopInvoke("keyring_set", { key, value });
  },

  /** Read `key` from the OS keyring, or `null` (also `null` on the web). */
  async get(key: string): Promise<string | null> {
    if (!isTauriDesktopRuntime()) return null;
    return (await desktopInvoke<string | null>("keyring_get", { key })) ?? null;
  },

  /** Delete `key` from the OS keyring. */
  async remove(key: string): Promise<void> {
    if (isTauriDesktopRuntime()) await desktopInvoke("keyring_delete", { key });
  },
};
