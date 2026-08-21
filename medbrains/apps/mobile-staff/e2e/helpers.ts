import { by, element, expect as detoxExpect, waitFor } from "detox";

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

export async function waitForId(id: string, timeout = VISIBLE_TIMEOUT): Promise<void> {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
}

/** Wait for a screen, by its stable id. */
export async function awaitScreen(testID: string, timeout = VISIBLE_TIMEOUT): Promise<void> {
  await waitForId(testID, timeout);
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
