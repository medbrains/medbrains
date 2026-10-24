/**
 * Colour contrast in both themes (WCAG 2.2 AA, SC 1.4.3 / 1.4.11).
 *
 * The app ships a light and a dark theme with a switcher; both must be
 * readable. Failures are grouped by foreground/background pair, because a pair
 * is one theme token to fix — not one element per screen.
 */
import { roles } from "@medbrains/design-system";
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

/** WCAG relative-luminance contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// The website theme: blue #0F62FE (primary) and purple #851B7F (secondary
// accent) are fills in both schemes, each with white on top; small blue/purple text uses the readable
// text roles (primaryText, tertiary). Every text role holds 4.5:1 on the
// canvas and on a card; borders hold 3:1 (SC 1.4.11).
test("the website-theme tokens hold AA contrast in both themes", () => {
  for (const scheme of ["light", "dark"] as const) {
    const r = roles[scheme];
    const card = scheme === "light" ? r.surfaceContainerLowest : r.surfaceContainerLow;
    const text = [
      ["white on brand blue", r.onPrimary, r.primary],
      ["white on brand purple", r.onTertiary, r.tertiaryBrand],
      ["body text", r.onSurface, r.surface],
      ["muted text", r.onSurfaceVariant, card],
      ["blue text", r.primaryText, card],
      ["blue text on canvas", r.primaryText, r.surface],
      ["purple text", r.tertiary, card],
      ["purple text on canvas", r.tertiary, r.surface],
      ["on primary container", r.onPrimaryContainer, r.primaryContainer],
      ["on tertiary container", r.onTertiaryContainer, r.tertiaryContainer],
      ["on success container", r.onSuccessContainer, r.successContainer],
      ["success on its container", r.success, r.successContainer],
    ] as const;
    for (const [pair, fg, bg] of text) {
      expect(contrast(fg, bg), `${scheme}: ${pair}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(r.outline, card), `${scheme}: input border`).toBeGreaterThanOrEqual(3);
  }
  // The brand fills are exactly the website's colours in both schemes.
  for (const r of [roles.light, roles.dark]) {
    expect(r.primary).toBe("#0f62fe");
    expect(r.tertiaryBrand).toBe("#851b7f");
  }
});

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
