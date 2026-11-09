import { afterEach, describe, expect, it } from "vitest";
import { desktopInvoke, isDesktopSetup, isTauriDesktopRuntime } from "./desktop-runtime";

type Global = { __TAURI_INTERNALS__?: { invoke: (cmd: string) => Promise<unknown> } };

function installTauri(invoke: (cmd: string) => Promise<unknown>) {
  (globalThis as Global).__TAURI_INTERNALS__ = { invoke };
}

afterEach(() => {
  delete (globalThis as Global).__TAURI_INTERNALS__;
  window.history.replaceState(null, "", "/");
});

describe("desktop runtime", () => {
  it("is the setup screen only inside the desktop window with the setup query", () => {
    window.history.replaceState(null, "", "/index.html?desktopSetup=1");
    expect(isDesktopSetup()).toBe(false);
    installTauri(async () => null);
    expect(isTauriDesktopRuntime()).toBe(true);
    expect(isDesktopSetup()).toBe(true);
    window.history.replaceState(null, "", "/login");
    expect(isDesktopSetup()).toBe(false);
  });

  it("turns a command's string refusal into an Error the screen can show", async () => {
    installTauri(() => Promise.reject("Use an https:// address."));
    await expect(desktopInvoke("desktop_server_connect")).rejects.toThrow(
      "Use an https:// address.",
    );
  });

  it("refuses off the desktop instead of calling nothing", async () => {
    await expect(desktopInvoke("desktop_server_forget")).rejects.toThrow("desktop app");
  });
});
