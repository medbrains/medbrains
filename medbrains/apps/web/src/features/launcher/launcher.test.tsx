import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/config/navigation";
import { LauncherPage } from "@/pages/launcher";
import { server } from "@/test/server";
import { render, screen } from "@/test/test-utils";
import { launcherApps, taggedBricks, visibleFavourites, visibleScreens } from "./launcherModel";

const BRICKS = taggedBricks(NAV_GROUPS);
const BRICK_NAMES = [
  { id: "lab", name: "Laboratory (LIS)" },
  { id: "pharmacy", name: "Pharmacy" },
];

/** A viewer holding exactly `codes`, with `off` bricks switched off. */
function viewer(codes: string[], off: string[] = []) {
  const held = new Set(codes);
  return { hasPermission: (c: string) => held.has(c), disabledModules: new Set(off) };
}

/** Answers the launcher read with `favourites`. */
function launcherReturns(favourites: string[]) {
  server.use(
    http.get("*/api/users/me/launcher", () =>
      HttpResponse.json({ favourites, bricks: BRICK_NAMES }),
    ),
  );
}

/** Signs in a non-bypass role holding `codes`, then opens the launcher. */
function openLauncher(codes: string[]) {
  usePermissionStore.getState().setPermissions("doctor", codes);
  render(
    <Routes>
      <Route path="/home" element={<LauncherPage />} />
      <Route path="/lab" element={<p>Lab worklist</p>} />
    </Routes>,
    { initialEntries: ["/home"] },
  );
}

afterEach(() => {
  usePermissionStore.getState().clearPermissions();
  useModuleStore.getState().clearModules();
});

describe("launcher access", () => {
  it("drops a favourite whose screen the person can no longer open", () => {
    const screens = visibleScreens(NAV_GROUPS, viewer(["pharmacy.prescriptions.list"]));
    const shown = visibleFavourites(["/lab", "/pharmacy"], screens).map((i) => i.path);
    expect(shown).toEqual(["/pharmacy"]);
  });

  it("shows no app for a brick the hospital switched off, even with the permission", () => {
    const codes = ["lab.orders.list", "pharmacy.prescriptions.list"];
    const on = launcherApps(visibleScreens(NAV_GROUPS, viewer(codes)), BRICKS);
    expect(on.map((a) => a.brick)).toEqual(["lab", "pharmacy"]);
    const off = launcherApps(visibleScreens(NAV_GROUPS, viewer(codes, ["pharmacy"])), BRICKS);
    expect(off.map((a) => a.brick)).toEqual(["lab"]);
  });

  it("takes a person with one app straight into it", async () => {
    launcherReturns([]);
    openLauncher(["lab.orders.list"]);
    expect(await screen.findByText("Lab worklist")).toBeInTheDocument();
  });

  it("shows two apps as tiles named by their brick, and no greyed ones", async () => {
    launcherReturns(["/pharmacy"]);
    openLauncher(["lab.orders.list", "pharmacy.prescriptions.list"]);
    const apps = await screen.findByRole("region", { name: "Your apps" });
    expect(apps).toHaveTextContent("Laboratory (LIS)");
    expect(apps).not.toHaveTextContent("Billing");
    expect(screen.getByRole("button", { name: /Remove .* from favourites/ })).toBeInTheDocument();
  });

  it("shows a failed read as a failure, never as an empty launcher", async () => {
    server.use(http.get("*/api/users/me/launcher", () => new HttpResponse(null, { status: 500 })));
    openLauncher(["lab.orders.list", "pharmacy.prescriptions.list"]);
    expect(await screen.findByRole("alert")).toHaveTextContent("didn't load");
    expect(screen.queryByText(/Star a screen/)).not.toBeInTheDocument();
  });
});
