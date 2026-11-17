import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { APP_SCREENS } from "@medbrains/types";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Route, Routes } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { visibleScreens } from "@/features/launcher/launcherModel";
import { MRD_PAGE_PERMISSIONS } from "@/pages/mrd-access";
import { REPORT_READERS } from "@/pages/reports/report-readers";
import { render, screen, userEvent, within } from "@/test/test-utils";
import nav from "../../public/locales/en/nav.json";
import { AppLayout } from "./AppLayout";
import { appOfRoute, panelFor } from "./appPanel";

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

/** A viewer holding exactly `codes`, with `off` bricks switched off. */
function viewer(codes: string[], off: string[] = []) {
  const held = new Set(codes);
  return { hasPermission: (c: string) => held.has(c), disabledModules: new Set(off) };
}

/** The paths the panel at `pathname` offers the viewer. */
function panelPaths(pathname: string, codes: string[], off: string[] = []) {
  const who = viewer(codes, off);
  return visibleScreens(panelFor(pathname, who).groups, who).map((item) => item.path);
}

describe("which app a route belongs to", () => {
  it("is the app of the closest registered screen above it", () => {
    expect(appOfRoute("/pharmacy")).toBe("pharmacy");
    expect(appOfRoute("/pharmacy/orders/42")).toBe("pharmacy");
    expect(appOfRoute("/pharmacy/finance/")).toBe("pharmacy");
    expect(appOfRoute("/analytics/paperless")).toBe("reports");
    expect(appOfRoute("/specialty/dental/7")).toBe("dental");
  });

  it("follows the nested screen, not the first path segment", () => {
    expect(appOfRoute("/admin/doctor-schedules")).toBe("opd");
    expect(appOfRoute("/admin/flows")).toBe("flow");
    expect(appOfRoute("/admin/users/7")).toBeNull();
  });

  it("is no app for a core screen, an unknown route or a look-alike prefix", () => {
    expect(appOfRoute("/dashboard")).toBeNull();
    expect(appOfRoute("/no-such-screen")).toBeNull();
    expect(appOfRoute("/opd-archive")).toBeNull();
    expect(appOfRoute("/")).toBeNull();
  });
});

describe("the side panel's screens", () => {
  const PHARMACIST = [
    "pharmacy.prescriptions.list",
    "pharmacy.h1_register.view",
    "lab.orders.list",
  ];

  it("inside Pharmacy are Pharmacy's only, and only those the person may open", () => {
    const shown = panelPaths("/pharmacy/orders/42", PHARMACIST);
    expect(shown).toEqual(["/pharmacy", "/pharmacy/h1-register"]);
    expect(shown).not.toContain("/lab");
    expect(shown).not.toContain("/pharmacy/quarantine");
  });

  it("on a core screen are the core screens and Administration, no app's", () => {
    const shown = panelPaths("/admin/users", ["dashboard.view", "admin.users.list", ...PHARMACIST]);
    expect(shown).toEqual([
      "/dashboard",
      "/approvals",
      "/health-pulse",
      "/admin/users",
      "/admin/groups",
    ]);
  });

  it("on an unknown route are the core screens, not the whole menu", () => {
    expect(panelPaths("/profile", ["dashboard.view", ...PHARMACIST])).toEqual([
      "/dashboard",
      "/approvals",
      "/health-pulse",
    ]);
  });

  it("fall back to core when the app is switched off or offers the person nothing", () => {
    expect(panelFor("/pharmacy", viewer(PHARMACIST, ["pharmacy"])).app).toBeNull();
    expect(panelFor("/billing", viewer(PHARMACIST)).app).toBeNull();
  });

  it("put every screen in exactly one panel", () => {
    const everyone = { hasPermission: () => true, disabledModules: new Set<string>() };
    const seen = APP_SCREENS.map((s) => panelFor(s.path, everyone).app);
    expect(seen).toEqual(APP_SCREENS.map((s) => s.brick));
  });
});

describe("pages that check the same permissions as their menu entry", () => {
  /** The registry's any-of list for `path`, sorted. */
  const anyOf = (path: string) =>
    [...(APP_SCREENS.find((s) => s.path === path)?.anyOf ?? [])].sort();

  it("Medical Records and Reports admit who their menu entry shows to", () => {
    expect(anyOf("/mrd")).toEqual([...MRD_PAGE_PERMISSIONS].sort());
    expect(anyOf("/reports")).toEqual([...REPORT_READERS].sort());
  });
});

describe("the shell's side panel", () => {
  beforeAll(() => {
    vi.stubGlobal("__APP_VERSION__", "0.0.0");
    vi.stubGlobal("__APP_COMMIT__", "test");
    vi.stubGlobal("__APP_BUILT__", "2026-11-17T00:00:00Z");
    return i18n.use(initReactI18next).init({ lng: "en", ns: ["nav"], resources: { en: { nav } } });
  });

  afterEach(() => {
    usePermissionStore.getState().clearPermissions();
    useModuleStore.getState().clearModules();
  });

  /** Signs in a non-bypass role holding `codes` and opens `path` inside the shell. */
  function openInShell(path: string, codes: string[]) {
    usePermissionStore.getState().setPermissions("pharmacist", codes);
    render(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/pharmacy/*" element={<p>Pharmacy screen</p>} />
        </Route>
        <Route path="/home" element={<p>Launcher</p>} />
      </Routes>,
      { initialEntries: [path] },
    );
  }

  it("names the app, lists its screens and leads back to all apps", async () => {
    openInShell("/pharmacy", ["pharmacy.prescriptions.list", "lab.orders.list"]);
    const panel = screen.getByTestId("app-sidebar");
    expect(within(panel).getByRole("heading", { name: "Pharmacy" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Pharmacy" })).toHaveAttribute(
      "href",
      "/pharmacy",
    );
    expect(within(panel).queryByRole("link", { name: "Lab" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("link", { name: "All apps" }));
    expect(await screen.findByText("Launcher")).toBeInTheDocument();
  });

  it("does not open a switched-off app's screen, whatever the route", () => {
    useModuleStore.getState().setDisabledModules(["pharmacy"]);
    openInShell("/pharmacy/finance", ["pharmacy.prescriptions.list"]);
    expect(
      screen.getByText("Pharmacy isn't part of this hospital's MedBrains"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pharmacy screen")).not.toBeInTheDocument();
  });
});
