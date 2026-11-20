import type { NavGroupConfig, NavItemConfig } from "@/config/navigation";

/** Who is looking: the permission check and the bricks the hospital switched off. */
export interface Viewer {
  hasPermission: (code: string) => boolean;
  disabledModules: ReadonlySet<string>;
}

/** One app on the launcher: a brick and the screen its tile opens. */
export interface LauncherApp {
  brick: string;
  /** The brick's first screen the viewer can open, in side-panel order. */
  home: NavItemConfig;
}

/**
 * Whether the viewer may see `item`: the side panel's rule, and search's. It
 * needs its permission, any one of its alternative permissions, and its brick
 * switched on.
 */
export function isItemVisible(item: NavItemConfig, viewer: Viewer): boolean {
  return (
    (!item.requiredPermission || viewer.hasPermission(item.requiredPermission)) &&
    (!item.requiredPermissions || item.requiredPermissions.some(viewer.hasPermission)) &&
    !(item.moduleCode && viewer.disabledModules.has(item.moduleCode))
  );
}

/**
 * Every screen the viewer can open, in side-panel order. A child counts only
 * when its parent entry is visible too, so a hidden section hides its pages.
 */
export function visibleScreens(groups: readonly NavGroupConfig[], viewer: Viewer): NavItemConfig[] {
  // ponytail: the menu nests one level (entry -> pages), so two bounded loops,
  // no recursion; a deeper menu needs this walked again.
  const out: NavItemConfig[] = [];
  for (const item of groups.flatMap((group) => group.items)) {
    if (!isItemVisible(item, viewer)) continue;
    if (!item.children) out.push(item);
    else out.push(...item.children.filter((child) => isItemVisible(child, viewer)));
  }
  return out;
}

/**
 * One app per brick the viewer has any screen in, in brick order, each opening
 * at its first screen in its side panel. The screen registry tags every app
 * screen with its brick (`moduleCode`). Screens outside every brick (the
 * dashboard, administration) are not apps; they stay reachable from the core
 * side panel, Spotlight and favourites.
 */
export function launcherApps(screens: readonly NavItemConfig[]) {
  const apps = new Map<string, LauncherApp>();
  for (const item of screens) {
    const brick = item.moduleCode;
    if (brick && !apps.has(brick)) apps.set(brick, { brick, home: item });
  }
  return [...apps.values()];
}

/**
 * The viewer's starred screens they can still open, in the order starred. A
 * star on a screen they lost stays stored and comes back with the access.
 */
export function visibleFavourites(
  favourites: readonly string[],
  screens: readonly NavItemConfig[],
) {
  const byPath = new Map(screens.map((item) => [item.path, item]));
  return favourites.flatMap((path) => byPath.get(path) ?? []);
}

/**
 * The first Administration screen the viewer can open, if any. Administration
 * belongs to no brick, so it is not an app, but for someone whose work is all
 * there it is the door the launcher should offer.
 */
export function administrationEntry(groups: readonly NavGroupConfig[], viewer: Viewer) {
  return visibleScreens(
    groups.filter((group) => group.key === "admin"),
    viewer,
  )[0];
}
