/**
 * The launcher, as a test reads it: which apps a person is offered, and opening one.
 *
 * The launcher (/home) replaced the whole-menu sidebar: "this role sees this module" is now a
 * tile on it, named after the app (BRICK_MANIFESTS), and the side panel lists one app at a time.
 * Someone with one app and no Administration is taken straight into it, so for them the app
 * they land in is the one they were offered.
 */
import { APP_SCREENS, BRICK_MANIFESTS } from "@medbrains/types";
import { expect, type Page } from "@playwright/test";
import { navigateTo } from "../helpers";

/** The launcher's "Your apps" section. */
const appsSection = (page: Page) => page.getByRole("region", { name: "Your apps" });

/** The name of the app that owns a screen path; undefined for a core screen, which has no tile. */
export function appOfPath(pathname: string): string | undefined {
  const brick = APP_SCREENS.find((s) => s.path === pathname)?.brick;
  return brick ? BRICK_MANIFESTS[brick]?.name : undefined;
}

/**
 * Open the launcher and wait until it has settled: its app tiles are drawn, or it has taken a
 * one-app person into their app. Returns the app it opened, or undefined when it shows tiles.
 */
async function settleLauncher(page: Page): Promise<string | undefined> {
  await navigateTo(page, "/home");
  await expect
    .poll(
      async () =>
        new URL(page.url()).pathname !== "/home" || (await appsSection(page).isVisible()),
      { timeout: 20_000, message: "the launcher shows its apps or opens the only one" },
    )
    .toBe(true);
  const pathname = new URL(page.url()).pathname;
  return pathname === "/home" ? undefined : (appOfPath(pathname) ?? pathname);
}

/** The apps the signed-in person is offered on the launcher, by name. */
export async function launcherAppNames(page: Page): Promise<string[]> {
  const opened = await settleLauncher(page);
  if (opened) return [opened];
  const names = await appsSection(page).getByRole("link").allInnerTexts();
  return names.map((name) => name.trim());
}

/** Open one app from the launcher by its tile, as a person does. */
export async function openLauncherApp(page: Page, app: string): Promise<void> {
  const opened = await settleLauncher(page);
  if (opened) {
    expect(opened, "the launcher opened the person's only app").toBe(app);
    return;
  }
  await appsSection(page).getByRole("link", { name: app, exact: true }).click();
  await expect(page).not.toHaveURL(/\/home(?:[?#].*)?$/);
}
