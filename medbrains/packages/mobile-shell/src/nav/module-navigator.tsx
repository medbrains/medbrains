/**
 * `ModuleNavigator` — composes a stack/drawer/tabs from the
 * accessible module list. The shell variant ("staff" | "patient" |
 * "tv" | "vendor") picks the chrome shape; modules supply screens.
 *
 * Implementation note: this file deliberately doesn't import
 * `@react-navigation/*` types directly — keeps the package
 * typecheckable when the host hasn't installed Navigation yet.
 * Hosts pass a `Navigator` factory that we render with the
 * accessible module list.
 */

import type { ComponentType, ReactNode } from "react";
import { useAuthStore } from "../auth/auth-store.js";
import { filterAccessibleModules } from "../types.js";
import type { ModuleList, ShellVariant } from "../types.js";

export interface NavigatorRenderProps {
  modules: ModuleList;
  variant: ShellVariant;
}

export interface ModuleNavigatorProps {
  modules: ModuleList;
  variant: ShellVariant;
  Navigator: ComponentType<NavigatorRenderProps>;
  fallback?: ReactNode;
}

export function ModuleNavigator(props: ModuleNavigatorProps): ReactNode {
  const { modules, variant, Navigator, fallback = null } = props;
  const identity = useAuthStore((s) => s.identity);
  const accessible = filterAccessibleModules(modules, identity);
  if (!identity) {
    return fallback;
  }
  return <Navigator modules={accessible} variant={variant} />;
}
