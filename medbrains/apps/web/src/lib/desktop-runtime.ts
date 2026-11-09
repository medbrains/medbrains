// The Tauri desktop client (apps/desktop). It opens the hospital server's own
// web app, so on the desktop this SPA talks to its own origin exactly as in a
// browser; only the first-launch setup screen runs from the app's bundle.

type TauriInternals = {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
};

/** The query the desktop opens its bundled setup screen with (src/commands/server.rs). */
const SETUP_PARAM = "desktopSetup";

/**
 * Tauri's IPC bridge, present in every page the desktop window loads. The app
 * sets `withGlobalTauri: false`, so `window.__TAURI__` is absent by design.
 */
function tauriInternals(): TauriInternals | null {
  const internals = (globalThis as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  return internals ?? null;
}

/** True when running inside the Tauri desktop window. */
export function isTauriDesktopRuntime(): boolean {
  return tauriInternals() !== null;
}

/** True on the desktop's first-launch screen that picks the hospital server. */
export function isDesktopSetup(): boolean {
  return (
    isTauriDesktopRuntime() && new URLSearchParams(window.location.search).get(SETUP_PARAM) === "1"
  );
}

/**
 * Call a desktop command; rejects off the desktop or when the app refuses it.
 * A command's `Err` arrives as a bare string, so it is wrapped in an `Error`
 * for the screens that show `error.message`.
 */
export async function desktopInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const internals = tauriInternals();
  if (!internals) throw new Error("Only the MedBrains desktop app can do this.");
  try {
    return await internals.invoke<T>(cmd, args);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
