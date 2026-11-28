import { useModuleStore } from "@medbrains/stores";
import { Outlet, useLocation } from "react-router";
import { appOfRoute } from "@/layouts/appPanel";
import { AppNotInstalledPage } from "@/pages/errors/app-not-installed";

/**
 * The shell's guard: the current route opens only while the hospital has the app it belongs to
 * (in the screen registry) switched on. A switched-off app's routes are not registered at all
 * (`enabledRoutes`), so its address reaches here and shows "not installed", never a crash or a
 * 404, and none of its chunks or queries are sent. The server refuses only the routers it gates
 * (`gated(...)` in `routes/mod.rs`), so this guard is not the access control.
 */
export function AppRoute() {
  const app = appOfRoute(useLocation().pathname);
  const enabled = useModuleStore((s) => !app || !s.disabledModules.has(app));
  return enabled || !app ? <Outlet /> : <AppNotInstalledPage brick={app} />;
}
