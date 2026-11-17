import { useModuleStore } from "@medbrains/stores";
import { Outlet, useLocation } from "react-router";
import { appOfRoute } from "@/layouts/appPanel";
import { AppNotInstalledPage } from "@/pages/errors/app-not-installed";

interface AppRouteProps {
  /**
   * The app brick's `module_config.code`, as in `crates/medbrains-core/src/bricks.rs`. Left out,
   * it is the app the current route belongs to in the screen registry (the shell's guard).
   */
  brick?: string;
}

/**
 * Wraps an app brick's routes so they open only while the hospital has the app switched on.
 * When it is off none of the app's screens mount, so none of its queries are sent. The server
 * refuses only the routers it gates (`gated(...)` in `routes/mod.rs`); the rest of an app's API
 * is gated in its own pass, so this guard is not the access control.
 */
export function AppRoute({ brick }: AppRouteProps) {
  const pathname = useLocation().pathname;
  const app = brick ?? appOfRoute(pathname);
  const enabled = useModuleStore((s) => !app || !s.disabledModules.has(app));
  return enabled || !app ? <Outlet /> : <AppNotInstalledPage brick={app} />;
}
