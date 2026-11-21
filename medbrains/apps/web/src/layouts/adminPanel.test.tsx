import { useAuthStore, useModuleStore, usePermissionStore } from "@medbrains/stores";
import { APP_SCREENS, BRICK_MANIFESTS } from "@medbrains/types";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Route, Routes } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { administrationPages } from "@/config/navigation";
import { isItemVisible } from "@/features/launcher/launcherModel";
import { render, screen, userEvent, within } from "@/test/test-utils";
import nav from "../../public/locales/en/nav.json";
import { AppLayout } from "./AppLayout";
import { advancedOpenKey } from "./PanelPages";

// The shell's header and overlays fetch their own data; the panel is what is under test.
vi.mock("@/components/HeaderWidgets", () => ({ HeaderWidgets: () => null }));
vi.mock("@/components/NewsMarquee", () => ({ NewsMarquee: () => null }));
vi.mock("@/components/NotificationCenter", () => ({ NotificationCenter: () => null }));
vi.mock("@/components/notes/NotesButton", () => ({ NotesButton: () => null }));
vi.mock("@/components/ai/AiAssistantMount", () => ({ AiAssistantMount: () => null }));
vi.mock("@/components/LiveActivityIsland/LiveActivityIsland", () => ({
  LiveActivityIsland: () => null,
}));
vi.mock("@/components/LiveActivityIsland/EmergencyCodeActivity", () => ({
  EmergencyCodeActivity: () => null,
}));
vi.mock("./OnDemandOverlays", () => ({ OnDemandOverlays: () => null }));

/** Every brick but `on`, as the first standalone hospital runs: Registration and OPD only. */
const offExcept = (...on: string[]) => Object.keys(BRICK_MANIFESTS).filter((b) => !on.includes(b));

/** Administration's paths an all-permission viewer sees with `off` bricks, usual and Advanced. */
function adminPaths(off: string[], showDevScreens = false) {
  const viewer = { hasPermission: () => true, disabledModules: new Set(off) };
  const pages = administrationPages(APP_SCREENS, showDevScreens).filter((p) =>
    isItemVisible(p, viewer),
  );
  return {
    usual: pages.filter((p) => !p.isAdvanced).map((p) => p.path),
    advanced: pages.filter((p) => p.isAdvanced).map((p) => p.path),
  };
}

const ESSENTIALS = [
  "/admin/users",
  "/admin/doctors",
  "/admin/roles",
  "/admin/groups",
  "/setup",
  "/admin/settings",
  "/admin/document-templates",
  "/admin/documents",
];
const DEV_ONLY = ["/admin/kernel", "/admin/test-cycles", "/admin/message-simulator"];

describe("Administration's pages", () => {
  it("for a Registration + OPD hospital are the essentials and those two apps' screens", () => {
    const { usual } = adminPaths(offExcept("registration", "opd"));
    expect(usual).toEqual([
      ...ESSENTIALS,
      "/admin/queues",
      "/admin/history-import",
      "/admin/doctor-schedules",
    ]);
  });

  it("add each app's admin screen while that app is on", () => {
    const { usual } = adminPaths([]);
    expect(usual).toEqual(expect.arrayContaining(["/admin/nabh-indicators", "/admin/flows"]));
    expect(adminPaths(offExcept("registration", "opd")).usual).not.toContain("/admin/flows");
  });

  it("keep integrations and devices under Advanced, and developer screens out of the menu", () => {
    const { usual, advanced } = adminPaths(offExcept("registration", "opd"));
    expect(advanced).toEqual(expect.arrayContaining(["/admin/api-keys", "/admin/webhooks"]));
    expect(advanced).toHaveLength(16);
    for (const path of DEV_ONLY) expect([...usual, ...advanced]).not.toContain(path);
  });

  it("list the developer screens in a development build", () => {
    expect(adminPaths([], true).usual).toEqual(expect.arrayContaining(DEV_ONLY));
  });
});

describe("the Advanced group in the side panel", () => {
  const USER_ID = "11111111-1111-1111-1111-111111111111";

  beforeAll(() => {
    vi.stubGlobal("__APP_VERSION__", "0.0.0");
    vi.stubGlobal("__APP_COMMIT__", "test");
    vi.stubGlobal("__APP_BUILT__", "2026-11-17T00:00:00Z");
    return i18n.use(initReactI18next).init({ lng: "en", ns: ["nav"], resources: { en: { nav } } });
  });

  afterEach(() => {
    usePermissionStore.getState().clearPermissions();
    useModuleStore.getState().clearModules();
    localStorage.clear();
  });

  /** Opens /admin/users as a hospital admin of a Registration + OPD hospital (a dev build, as
   * vitest runs, so the developer screens are listed; `adminPaths` covers a release build). */
  function openAdmin() {
    useAuthStore.setState({ user: { id: USER_ID } } as never);
    usePermissionStore.getState().setPermissions("hospital_admin", []);
    useModuleStore.getState().setDisabledModules(offExcept("registration", "opd"));
    return render(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={<p>Admin screen</p>} />
        </Route>
      </Routes>,
      { initialEntries: ["/admin/users"] },
    );
  }

  it("starts closed, opens to its screens, and stays open for this person", async () => {
    const first = openAdmin();
    const panel = screen.getByTestId("app-sidebar");
    const advanced = within(panel).getByRole("button", { name: "Advanced" });
    expect(advanced).toHaveAttribute("aria-expanded", "false");
    expect(within(panel).getByRole("link", { name: "Queues" })).toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "Flows" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "API keys" })).not.toBeInTheDocument();

    await userEvent.click(advanced);
    expect(advanced).toHaveAttribute("aria-expanded", "true");
    expect(await within(panel).findByRole("link", { name: "API keys" })).toBeInTheDocument();
    expect(localStorage.getItem(advancedOpenKey(USER_ID))).toBe("true");

    first.unmount();
    openAdmin();
    expect(
      within(screen.getByTestId("app-sidebar")).getByRole("button", { name: "Advanced" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
