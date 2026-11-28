import { useModuleStore } from "@medbrains/stores";
import { Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AppRoute } from "./AppRoute";

function renderEmrRoute() {
  return render(
    <Routes>
      <Route element={<AppRoute />}>
        <Route path="/opd" element={<p>OPD queue screen</p>} />
      </Route>
    </Routes>,
    { initialEntries: ["/opd"] },
  );
}

describe("AppRoute", () => {
  afterEach(() => useModuleStore.getState().clearModules());

  it("opens the app's screen while the hospital has the app on", () => {
    useModuleStore.getState().setDisabledModules(["lab"]);
    renderEmrRoute();
    expect(screen.getByText("OPD queue screen")).toBeInTheDocument();
  });

  it("shows that the app is not installed, and never mounts its screen, when it is off", () => {
    useModuleStore.getState().setDisabledModules(["opd"]);
    renderEmrRoute();
    expect(
      screen.getByText("OPD / Outpatient isn't part of this hospital's MedBrains"),
    ).toBeInTheDocument();
    expect(screen.queryByText("OPD queue screen")).not.toBeInTheDocument();
  });

  it("guards a nested route of the app it belongs to and leaves core screens open", () => {
    useModuleStore.getState().setDisabledModules(["lab", "pharmacy"]);
    const shell = (path: string) =>
      render(
        <Routes>
          <Route element={<AppRoute />}>
            <Route path="*" element={<p>Screen</p>} />
          </Route>
        </Routes>,
        { initialEntries: [path] },
      );
    const lab = shell("/lab/orders/42");
    expect(
      screen.getByText("Laboratory (LIS) isn't part of this hospital's MedBrains"),
    ).toBeInTheDocument();
    lab.unmount();
    shell("/admin/users");
    expect(screen.getByText("Screen")).toBeInTheDocument();
  });
});
