/**
 * Accessibility and reachability checks every journey runs on the screens it
 * visits (WCAG 2.2 AA — medbrains/docs/WCAG-2.2-RULES.md).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import axe from "axe-core";

const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Violations already present on a screen before this work, by axe rule id.
 * A journey fails on anything new; an entry here is debt with a name, to be
 * removed when fixed — never a place to hide a new finding.
 */
const KNOWN: Record<string, readonly string[]> = {};

/** axe WCAG 2.2 AA on the page's main region; fails on any unrecorded violation. */
export async function expectScreenAccessible(page: Page, screen: string): Promise<void> {
  await waitForSettledScreen(page);
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async (tags) => {
    const root = document.querySelector("main") ?? document;
    const result = await (window as unknown as { axe: typeof axe }).axe.run(root, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => ({
        target: n.target.join(" "),
        html: n.html.slice(0, 160),
        why: n.failureSummary?.split("\n").slice(1, 2).join(" ").trim(),
      })),
    }));
  }, AA_TAGS);
  const known = new Set(KNOWN[screen] ?? []);
  const fresh = violations.filter((v) => !known.has(v.id));
  expect(fresh, `${screen}: WCAG 2.2 AA violations\n${JSON.stringify(fresh, null, 2)}`).toEqual([]);
}

/**
 * The control is there, enabled, reachable by keyboard, and nothing covers it:
 * a trial click fails when another element (a floating launcher, an overlay)
 * would receive the click instead.
 */
export async function expectUsable(control: Locator, name: string): Promise<void> {
  await expect(control, `${name} is visible`).toBeVisible();
  await expect(control, `${name} is enabled`).toBeEnabled();
  await control.focus();
  await expect(control, `${name} is keyboard focusable`).toBeFocused();
  await control.click({ trial: true, timeout: 5_000 });
}

/**
 * The screen has settled: the loading skeleton is gone and every finite
 * animation (page fade-in, drawer slide) has finished. Scanning earlier caught
 * text half-way through a fade and reported contrast the user never sees.
 * Infinite decorative loops are ignored. No fixed sleeps.
 */
export async function waitForSettledScreen(page: Page): Promise<void> {
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(0, {
    timeout: 20_000,
  });
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== "running" ||
            a.effect?.getComputedTiming().iterations === Number.POSITIVE_INFINITY,
        ),
    undefined,
    { timeout: 10_000 },
  );
}
