import { useModuleStore } from "@medbrains/stores";
import { useMemo } from "react";
import { useRoutes } from "react-router";
import { AUTHED_ROUTES } from "./AuthedRoutes";
import { enabledRoutes } from "./layouts/appPanel";

/**
 * The signed-in app, mounted by App under `/*`; split from App so sign-in and the public pages
 * never load the route table. Only switched-on apps' routes are registered (`enabledRoutes`), so
 * a switched-off app's page chunk is never fetched; its address falls to the shell guard
 * (`AppRoute`), which says the app is not installed.
 */
export function AuthedApp() {
  const disabledModules = useModuleStore((s) => s.disabledModules);
  const routes = useMemo(() => enabledRoutes(AUTHED_ROUTES, disabledModules), [disabledModules]);
  return useRoutes(routes);
}
