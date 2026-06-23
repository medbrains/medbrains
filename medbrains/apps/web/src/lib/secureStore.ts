// OS keyring-backed secure storage on the desktop (Tauri) — macOS Keychain,
// Windows Credential Manager, Linux Secret Service (libsecret/D-Bus), via the
// keyring_* commands in apps/desktop. On the web there is no Tauri, so these are
// no-ops: the browser session lives in HttpOnly cookies instead. Use this for
// the session / SSO access token on desktop so it never sits in localStorage.

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function tauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __TAURI__?: { core?: { invoke?: TauriInvoke } } };
  return w.__TAURI__?.core?.invoke ?? null;
}

/** True when running inside the Tauri desktop shell (keyring available). */
export function isDesktop(): boolean {
  return tauriInvoke() !== null;
}

export const secureStore = {
  isAvailable: isDesktop,

  /** Store an opaque secret (e.g. the access token) under `key` in the OS keyring. */
  async set(key: string, value: string): Promise<void> {
    const invoke = tauriInvoke();
    if (invoke) await invoke("keyring_set", { key, value });
  },

  /** Read `key` from the OS keyring, or `null` (also `null` on the web). */
  async get(key: string): Promise<string | null> {
    const invoke = tauriInvoke();
    return invoke ? ((await invoke<string | null>("keyring_get", { key })) ?? null) : null;
  },

  /** Delete `key` from the OS keyring. */
  async remove(key: string): Promise<void> {
    const invoke = tauriInvoke();
    if (invoke) await invoke("keyring_delete", { key });
  },
};
