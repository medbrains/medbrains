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

/**
 * How much of a control must be on screen before it is pressed.
 *
 * Only meaningful when the testID sits on an unclipped view -- see the wrapper
 * around the register-patient submit. 75 rather than 100 because Detox counts
 * the debug build's LogBox overlay as an occluding window and never scores a
 * bottom-of-form control at 100, however plainly visible it is. Well above 50
 * is what matters: it puts the element's centre, which is where the tap lands,
 * inside the visible region.
 */
export const TAP_TARGET_VISIBILITY = 75;

/** Let scroll momentum and layout finish before trusting a position. */
function settle(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for an element to be MOUNTED, not scored visible.
 *
 * Detox's visibility percentage is not trustworthy on these screens: on the
 * OPD token it reported "not visible" for a card its own debug capture shows
 * whole and unobstructed, and it mis-scored the registration submit the same
 * way. Where a view is mounted only on a real outcome -- the token card renders
 * only once the server has returned a token -- existence is the honest
 * assertion, and a stronger one than a threshold that lies in both directions.
 */
export async function waitForIdToExist(id: string, timeout = VISIBLE_TIMEOUT): Promise<void> {
  await waitFor(element(by.id(id))).toExist().withTimeout(timeout);
}

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
 * Assert a screen is the one expected, by more than a single element.
 *
 * `awaitScreen` proves one id exists somewhere. That is weaker than it reads:
 * a screen half-rendered, or the right header over the wrong body, satisfies
 * it. Naming the header *and* what the screen is for makes the assertion about
 * the screen rather than about an element that happens to be on it.
 *
 * This is still not a check that the screen *looks* right — no matcher-based
 * runner does that, Maestro included. Visual drift needs a baseline image, and
 * the automatic frames this suite captures are what a human reviews meanwhile.
 */
export async function assertScreen(
  screenID: string,
  mustAlsoShow: readonly string[],
  timeout = VISIBLE_TIMEOUT,
): Promise<void> {
  await waitForId(screenID, timeout);
  for (const id of mustAlsoShow) {
    await detoxExpect(element(by.id(id))).toExist();
  }
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

/**
 * Tap the control at the end of a scrollable form.
 *
 * Two separate problems, and conflating them cost several red runs.
 *
 * The keyboard is dismissed with the return key, not a swipe. A swipe usually
 * works and sometimes does not, which made this spec pass one run and fail the
 * next on unchanged code — worse than a failure, because a suite nobody trusts
 * gets ignored. And it has to go down *before* the scroll: these forms are
 * keyboard-avoiding, so while it is up the scroll view is shrunk around it and
 * "the bottom" is the bottom of a shorter view.
 *
 * The scroll itself stays incremental. `scrollTo("bottom")` reads as the more
 * deterministic idiom and lands mid-form on the long registration form, so the
 * step-until-visible walk is the one that actually works here.
 */
export async function tapAtFormEnd(
  testID: string,
  formID: string,
  options: { dismissKeyboardFrom?: string; until?: string } = {},
): Promise<void> {
  const { dismissKeyboardFrom, until } = options;
  if (dismissKeyboardFrom) {
    await element(by.id(dismissKeyboardFrom)).tapReturnKey();
  }

  // Press, then prove the press landed by what it caused. Every attempt to
  // decide beforehand whether the control was pressable failed:
  //
  // - `whileElement().scroll()` gives up while the submit is still below.
  // - `scrollTo("bottom")` returns without moving anything on the New
  //   Architecture, leaving the form at the top.
  // - A visibility gate cannot be trusted either way. At 50 the centre can sit
  //   under something and `tap()` reports success having pressed nothing; at 75
  //   or 100 a plainly visible control still fails, because Detox counts the
  //   debug build's LogBox overlay as an occluding window.
  //
  // So the only reliable signal is the consequence. `until` is the screen the
  // press must produce; without it there is nothing to verify and one tap is
  // all we can honestly do. Re-tapping cannot double-submit: the button is
  // disabled while the write is in flight.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await element(by.id(testID)).tap();
    } catch {
      // Not reachable yet — the swipe below brings it into range.
    }
    if (!until) return;
    try {
      await waitFor(element(by.id(until))).toExist().withTimeout(8000);
      return;
    } catch {
      // The form may be gone precisely BECAUSE the press worked and the screen
      // moved on while we were waiting. Swiping a screen that no longer exists
      // is not a failure, so do not let it mask the success: fall through and
      // let the next iteration look for `until` again.
      try {
        await element(by.id(formID)).swipe("up", "slow");
      } catch {
        // Screen already replaced.
      }
      await settle();
    }
  }
  // Out of attempts: let the real matcher raise, naming the screen we wanted.
  await waitForIdToExist(until ?? testID);
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
