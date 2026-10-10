/**
 * WCAG 2.2 SC 1.4.10 Reflow: at 320 CSS px wide — 1280 px at 400% zoom — a
 * page reads without scrolling sideways. A bar that wraps into itself or an
 * address that will not break shows up here as a page wider than the window.
 */
import { expect, test } from "../journeys/support/world";

const SCREENS = ["/dashboard", "/patients", "/opd/new", "/home-visits", "/mrd"];

test("the main screens reflow at 400% zoom", async ({ hospital }) => {
  test.setTimeout(120_000);
  const page = await hospital.asAdmin();
  await page.setViewportSize({ width: 320, height: 640 });
  const overflowing: string[] = [];
  for (const path of SCREENS) {
    await page.goto(path);
    // Live sockets keep the network busy; let the screen settle instead.
    await page.locator("main").first().waitFor();
    await page.waitForTimeout(2_500);
    const extra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (extra > 1) overflowing.push(`${path} (+${extra}px)`);
  }
  expect(overflowing, "pages wider than a 320px window").toEqual([]);
});
