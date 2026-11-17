import { APP_SCREENS } from "@medbrains/types";
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
