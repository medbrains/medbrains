import { APP_SCREENS } from "@medbrains/types";
import type { RouteObject } from "react-router";
import { NAV_GROUPS, type NavGroupConfig } from "@/config/navigation";
import { type Viewer, visibleScreens } from "@/features/launcher/launcherModel";

/** Every registry screen, longest route first, so the first prefix that matches is the closest. */
// ponytail: a linear scan of ~130 routes per navigation; a trie if the registry reaches thousands.
const BY_ROUTE_LENGTH = [...APP_SCREENS].sort((a, b) => b.path.length - a.path.length);

/** The core panel: the screens no app owns, then Administration. */
const CORE_GROUPS = NAV_GROUPS.filter((group) => group.key === "core" || group.key === "admin");

/**
 * The app brick the screen at `pathname` belongs to, or `null` for a core screen or a route the
 * registry does not know. A nested route belongs to the screen it sits under, closest first:
 * `/pharmacy/orders/42` is Pharmacy's, `/admin/doctor-schedules` is OPD's, `/admin/users/7` core.
 */
export function appOfRoute(pathname: string): string | null {
  const screen = BY_ROUTE_LENGTH.find(
    (s) => pathname === s.path || pathname.startsWith(`${s.path}/`),
  );
  return screen?.brick ?? null;
}

/**
 * `routes` without every route a switched-off app owns (by `appOfRoute` of its full path), at
 * any depth, so the router never registers them and never fetches their code-split pages. Ids
 * are the registry's, so the screen registry stays the one owner of every route.
 */
export function enabledRoutes(
  routes: RouteObject[],
  disabledModules: ReadonlySet<string>,
  parent = "",
): RouteObject[] {
  return routes.flatMap((route) => {
    const path = route.path ? `${parent}/${route.path}`.replace(/\/+/g, "/") : parent;
    const app = route.path ? appOfRoute(path) : null;
    if (app && disabledModules.has(app)) return [];
    if (!route.children) return [route];
    return [
      { ...route, children: enabledRoutes(route.children, disabledModules, path) } as RouteObject,
    ];
  });
}

/** What the side panel shows: the app it is in (`null` = core) and that app's menu groups. */
export interface Panel {
  app: string | null;
  groups: NavGroupConfig[];
}

/**
 * The side panel for the screen at `pathname`: only its app's screens, never the whole menu.
 * A core screen, an unknown route, a switched-off app, or an app in which the viewer can open
 * nothing gets the core panel instead, so the panel is never empty.
 */
export function panelFor(pathname: string, viewer: Viewer): Panel {
  const app = appOfRoute(pathname);
  if (app && !viewer.disabledModules.has(app)) {
    const groups = NAV_GROUPS.filter((group) => group.key === app);
    if (visibleScreens(groups, viewer).length > 0) return { app, groups };
  }
  return { app: null, groups: CORE_GROUPS };
}
