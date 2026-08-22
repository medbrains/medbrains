import { by, device, element, expect as detoxExpect, waitFor } from "detox";

/**
 * How long a first paint is allowed to take on a cold simulator.
 *
 * Explicit rather than left to Detox's auto-sync: the New Architecture's idle
 * detection does not cover every async path, and a spec that hangs on an
 * un-synced fetch fails with a useless timeout instead of a named one.
 */
export const VISIBLE_TIMEOUT = 30_000;

/**
 * The first wait after a fresh install, which is a different animal.
 *
 * `launchApp({ delete: true })` reinstalls, and a Debug build then re-downloads
 * its whole bundle from Metro before it draws anything — comfortably more than
 * the 30s a settled screen needs. Running three suites serially, every one of
 * them paid that cost and every one of them failed on the first matcher, which
 * reads like three broken screens and is one cold start.
 *
 * A Release build embeds the bundle and does not need this; the config note
 * about CI running Release is the same point from the other side.
 */
export const COLD_START_TIMEOUT = 120_000;

/**
 * How much of a control has to be on screen for a scroll-into-view to accept it.
 *
 * Detox defaults to 75%. The last item on a module home cannot reach that in a
 * Debug build: React Native's dev-warning toasts sit over the bottom of the
 * screen and the list has already scrolled as far as it goes. Those toasts do
 * not exist in a Release build, which is what CI runs — so this is a
 * concession to the debug harness, not to the app.
 *
 * Half is still a real assertion: an element genuinely off-screen or behind a
 * modal fails it.
 */
export const LAST_ITEM_VISIBILITY = 50;

export async function waitForId(id: string, timeout = VISIBLE_TIMEOUT): Promise<void> {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
}

/**
 * A named frame in the run's filmstrip.
 *
 * Detox already snapshots every test start and end, but those are named after
 * the test. A journey wants frames named after what the desk just did —
 * `02-registered`, `04-token-issued` — so somebody reviewing the run can see
 * the sequence without reading the spec. Numbered because artifact directories
 * sort lexically and a journey out of order is not a journey.
 *
 * Cheap enough to call freely: `device.takeScreenshot` is a simulator capture,
 * not a round trip to the app.
 */
export async function frame(name: string): Promise<void> {
  await device.takeScreenshot(name);
}

/** Wait for a screen, by its stable id. */
export async function awaitScreen(testID: string, timeout = VISIBLE_TIMEOUT): Promise<void> {
  await waitForId(testID, timeout);
}

/**
 * Scroll a container until the control is on screen, then tap it.
 *
 * `toBeVisible` means visible, not merely mounted, so an action near the
 * bottom of a module home fails a plain `tapId` — correctly. Scrolling is what
 * the user does; asserting on a mounted-but-offscreen element would pass on a
 * screen nobody can reach.
 */
export async function tapIdScrollingIn(
  testID: string,
  containerID: string,
  visiblePercent = LAST_ITEM_VISIBILITY,
): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible(visiblePercent)
    .whileElement(by.id(containerID))
    .scroll(240, "down");
  await element(by.id(testID)).tap();
}

/** Tap a control by id, once it is actually on screen. */
export async function tapId(testID: string, timeout = VISIBLE_TIMEOUT): Promise<void> {
  await waitForId(testID, timeout);
  await element(by.id(testID)).tap();
}

export async function signIn(username: string, password: string): Promise<void> {
  await waitForId("login-identifier");
  await element(by.id("login-identifier")).typeText(username);
  await element(by.id("login-password")).typeText(password);
  await element(by.id("login-submit")).tap();
}

/**
 * Assert that exactly one of several mutually exclusive states is on screen.
 *
 * A queue screen has three legitimate outcomes — rows, "nothing waiting", and
 * "could not load" — and the last two are different facts a nurse acts on
 * differently. Asserting only that the screen rendered would pass on all three,
 * including the one where the ward looks quiet because the network is down.
 */
export async function expectOneOf(ids: readonly string[]): Promise<void> {
  const visible: string[] = [];
  for (const id of ids) {
    try {
      await detoxExpect(element(by.id(id))).toBeVisible();
      visible.push(id);
    } catch {
      // Not this one.
    }
  }
  if (visible.length !== 1) {
    throw new Error(
      `expected exactly one of [${ids.join(", ")}] to be visible, found [${visible.join(", ")}]`,
    );
  }
}
