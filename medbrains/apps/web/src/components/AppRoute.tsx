import { useModuleStore } from "@medbrains/stores";
import { Outlet } from "react-router";
import { AppNotInstalledPage } from "@/pages/errors/app-not-installed";

interface AppRouteProps {
  /** The app brick's `module_config.code`, as in `crates/medbrains-core/src/bricks.rs`. */
  brick: string;
}

/**
 * Wraps an app brick's routes so they open only while the hospital has the app switched on.
 * When it is off none of the app's screens mount, so none of its queries are sent; the server
 * refuses them anyway, this keeps the screen honest about it.
 */
export function AppRoute({ brick }: AppRouteProps) {
  const enabled = useModuleStore((s) => !s.disabledModules.has(brick));
  return enabled ? <Outlet /> : <AppNotInstalledPage brick={brick} />;
}
