/**
 * Colour contrast in both themes (WCAG 2.2 AA, SC 1.4.3 / 1.4.11).
 *
 * The app ships a light and a dark theme with a switcher; both must be
 * readable. Failures are grouped by foreground/background pair, because a pair
 * is one theme token to fix — not one element per screen.
 */
import { expect, test } from "@playwright/test";
import axe from "axe-core";
import { routeApiDirect } from "../helpers";
import { waitForSettledScreen } from "../journeys/support/a11y";

const SCREENS = [
  "/dashboard",
  "/patients",
  "/patients/register",
  "/opd",
  "/token-console",
  "/token-board",
  "/admin/queues",
  "/admin/message-simulator",
  "/admin/settings",
];

interface Failure {
  pair: string;
  ratio: string;
  sample: string;
  screen: string;
}

for (const scheme of ["light", "dark"] as const) {
  test(`every key screen is readable in the ${scheme} theme`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((value) => {
      localStorage.setItem("mantine-color-scheme-value", value);
    }, scheme);
    await routeApiDirect(page);

    const failures: Failure[] = [];
    for (const screen of SCREENS) {
      await page.goto(screen);
      // Not "networkidle": boards poll and hold a socket open, so the network
      // is never idle. The screen is ready when its main region has content.
      await expect(page.locator("main")).toBeVisible();
      await waitForSettledScreen(page);
      await page.addScriptTag({ content: axe.source });
      const found = await page.evaluate(async () => {
        const result = await (window as unknown as { axe: typeof axe }).axe.run(document, {
          runOnly: { type: "rule", values: ["color-contrast"] },
          resultTypes: ["violations"],
        });
        return result.violations.flatMap((v) =>
          v.nodes.map((n) => {
            const data = (n.any[0]?.data ?? {}) as {
              fgColor?: string;
              bgColor?: string;
              contrastRatio?: number;
            };
            return {
              pair: `${data.fgColor} on ${data.bgColor}`,
              ratio: String(data.contrastRatio),
              sample: n.html.slice(0, 110),
            };
          }),
        );
      });
      failures.push(...found.map((f) => ({ ...f, screen })));
    }

    const byPair = new Map<string, Failure[]>();
    for (const f of failures) byPair.set(f.pair, [...(byPair.get(f.pair) ?? []), f]);
    const summary = [...byPair.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([pair, hits]) => ({
        pair,
        ratio: hits[0]?.ratio,
        count: hits.length,
        screens: [...new Set(hits.map((h) => h.screen))],
        sample: hits[0]?.sample,
      }));
    // One machine-readable line per run, for the audit that sizes the fix.
    // biome-ignore lint/suspicious/noConsole: test report output
    console.log(`CONTRAST_SUMMARY ${scheme} ${JSON.stringify(summary)}`);
    expect(summary, `${scheme}: contrast failures by colour pair\n${JSON.stringify(summary, null, 2)}`).toEqual([]);
  });
}
