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
 * Whether the viewer may see `item`: the side panel's rule. It needs its
 * permission, any one of its alternative permissions, and its brick switched
 * on. (Spotlight checks permissions only and still ignores bricks: #5995.)
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
  // no recursion; a deeper menu needs this and taggedBricks walked again.
  const out: NavItemConfig[] = [];
  for (const item of groups.flatMap((group) => group.items)) {
    if (!isItemVisible(item, viewer)) continue;
    if (!item.children) out.push(item);
    else out.push(...item.children.filter((child) => isItemVisible(child, viewer)));
  }
  return out;
}

/** Every brick code the side panel tags a screen with. */
export function taggedBricks(groups: readonly NavGroupConfig[]): Set<string> {
  const items = groups.flatMap((group) => group.items);
  const all = [...items, ...items.flatMap((item) => item.children ?? [])];
  return new Set(all.flatMap((item) => item.moduleCode ?? []));
}

/**
 * The brick a screen belongs to: its `moduleCode` tag, or else the first path
 * segment when that names a brick (the OPD queue `/opd` and `/ipd` carry no tag,
 * so the menu decides their visibility, but they are still their app's door).
 */
function brickOf(item: NavItemConfig, bricks: ReadonlySet<string>): string | undefined {
  if (item.moduleCode) return item.moduleCode;
  const segment = item.path.split("/")[1] ?? "";
  return bricks.has(segment) ? segment : undefined;
}

/**
 * One app per brick the viewer has any screen in, ordered by where the brick
 * first appears in the side panel. Screens outside every brick (the dashboard,
 * administration) are not apps; they stay reachable from the side panel,
 * Spotlight and favourites.
 */
export function launcherApps(screens: readonly NavItemConfig[], bricks: ReadonlySet<string>) {
  // ponytail: an app opens at its first screen in side-panel order; switch to the
  // generated per-app panel (APP_SCREENS, PR #5959) once it lands.
  const apps = new Map<string, LauncherApp>();
  for (const item of screens) {
    const brick = brickOf(item, bricks);
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
