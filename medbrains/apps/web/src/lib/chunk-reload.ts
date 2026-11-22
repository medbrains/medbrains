/**
 * Recovery for a tab left open across a web update.
 *
 * Every screen is a lazy chunk with a hashed name. When the server's web files
 * are swapped, a tab still running the old bundle asks for old chunk names on
 * its next navigation, and they are gone. Reloading fetches the new
 * `index.html` (served `no-store`) and with it the new chunk names. The guard
 * allows one reload per build, so a chunk that is missing from the new build
 * too ends on the error screen instead of a reload loop.
 */

/** Identifies the running bundle; a new build gets a new key, so it may reload once too. */
const BUILD_ID =
  typeof __APP_BUILT__ === "undefined" ? __APP_VERSION__ : `${__APP_COMMIT__}@${__APP_BUILT__}`;

const GUARD_PREFIX = "mb:chunk-reload:";

/** Browser messages for a dynamic import or preload that could not be fetched. */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** True when an error is a lazy chunk (or its CSS) failing to load, not a bug in a screen. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

interface ReloadOptions {
  buildId?: string;
  storage?: Pick<Storage, "getItem" | "setItem">;
  reload?: () => void;
}

/**
 * Reloads the page unless this build already reloaded once in this tab, and
 * says whether it did. When the guard cannot be read or written it does not
 * reload, since an unguarded reload could loop.
 */
export function reloadOnceForNewBuild(options: ReloadOptions = {}): boolean {
  const key = GUARD_PREFIX + (options.buildId ?? BUILD_ID);
  try {
    const storage = options.storage ?? window.sessionStorage;
    if (storage.getItem(key)) return false;
    storage.setItem(key, "1");
  } catch {
    return false;
  }
  (options.reload ?? (() => window.location.reload()))();
  return true;
}

/** Reloads once when Vite reports a chunk or its preload failed (`vite:preloadError`). */
export function installChunkLoadRecovery(): void {
  window.addEventListener("vite:preloadError", () => {
    reloadOnceForNewBuild();
  });
}
