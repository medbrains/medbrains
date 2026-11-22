import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChunkLoadRecovery, isChunkLoadError, reloadOnceForNewBuild } from "./chunk-reload";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe("chunk-load recovery", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("recognises the browsers' chunk-load messages and nothing else", () => {
    expect(
      isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /a.js")),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/x.css"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });

  it("reloads once per build, then lets the error show", () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadOnceForNewBuild({ buildId: "b1", storage, reload })).toBe(true);
    expect(reloadOnceForNewBuild({ buildId: "b1", storage, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    // The new build the reload fetched gets its own single reload.
    expect(reloadOnceForNewBuild({ buildId: "b2", storage, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload when the guard cannot be stored, so it can never loop", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage blocked");
      },
    };
    expect(reloadOnceForNewBuild({ buildId: "b1", storage, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("answers vite:preloadError by marking this build as reloaded", () => {
    installChunkLoadRecovery();
    // jsdom cannot really reload; the guard key proves the handler ran.
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(window.sessionStorage.getItem(`mb:chunk-reload:${__APP_VERSION__}`)).toBe("1");
  });
});
