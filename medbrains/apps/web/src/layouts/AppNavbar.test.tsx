import { AppShell } from "@mantine/core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AppNavbar, hasSidePanel } from "./AppNavbar";

// Build stamps Vite defines at build time; the panel's footer shows them.
beforeAll(() => {
  vi.stubGlobal("__APP_VERSION__", "0.0.0");
  vi.stubGlobal("__APP_COMMIT__", "test");
  vi.stubGlobal("__APP_BUILT__", "2026-11-17T00:00:00Z");
});

describe("side panel", () => {
  it("is left off the launcher, which replaces navigation, and kept everywhere else", () => {
    expect(hasSidePanel("/home")).toBe(false);
    expect(hasSidePanel("/opd")).toBe(true);
    expect(hasSidePanel("/home-visits")).toBe(true);
  });

  it("renders the menu it is given with its collapse control", () => {
    render(
      <AppShell navbar={{ width: 240, breakpoint: "sm" }}>
        <AppNavbar isExpanded onToggle={() => undefined}>
          <p>Menu</p>
        </AppNavbar>
      </AppShell>,
    );
    expect(screen.getByTestId("app-sidebar")).toHaveTextContent("Menu");
    expect(screen.getByRole("button", { name: "collapse" })).toBeInTheDocument();
  });
});
