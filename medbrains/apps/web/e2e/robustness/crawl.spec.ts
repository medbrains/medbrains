/**
 * Nothing breaks when used — every page each role can reach, and every tab on
 * it, opened the way that role opens it: from their own sidebar.
 *
 * A page fails on what a person at the screen would hit: the error screen
 * ("Screen unavailable"), a blank page, an error toast, a JavaScript error, a
 * server error (5xx), or a request the role is refused (403) — the screen
 * asked for data it should not have asked for, which the person sees as an
 * error or a hole. No per-page code: the sidebar is the list.
 */
import { expect, type Page, test } from "@playwright/test";
import { loginAsRole, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { waitForSettledScreen } from "../journeys/support/a11y";

const ROLES = [
  "receptionist",
  "front_office_staff",
  "doctor",
  "nurse",
  "pharmacist",
  "lab_technician",
  "billing_clerk",
  "camp_coordinator",
  "super_admin",
];

/** Development noise, not something a user of the product would meet. */
const NOISE = [/\[vite\]/i, /WebSocket closed without opened/i, /Download the React DevTools/i];

interface Problem {
  page: string;
  what: string;
}

function watch(page: Page, problems: Problem[], current: () => string) {
  page.on("pageerror", (error) =>
    problems.push({ page: current(), what: `JS error: ${error.message.slice(0, 160)}` }),
  );
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (NOISE.some((pattern) => pattern.test(text))) return;
    problems.push({ page: current(), what: `console error: ${text.slice(0, 160)}` });
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/")) return;
    const status = response.status();
    if (status >= 500 || status === 403) {
      problems.push({
        page: current(),
        what: `${status} ${response.request().method()} ${url.pathname}`,
      });
    }
  });
}

async function checkScreen(page: Page, problems: Problem[], where: string): Promise<void> {
  await waitForSettledScreen(page);
  if (await page.getByRole("heading", { name: "Screen unavailable" }).count()) {
    problems.push({ page: where, what: "error screen (Screen unavailable)" });
  }
  // Full-screen pages (the waiting-room display, kiosk) have no <main>.
  const region = (await page.locator("main").count()) > 0 ? page.locator("main") : page.locator("body");
  const text = ((await region.first().textContent({ timeout: 5_000 })) ?? "").trim();
  if (text.length < 20) problems.push({ page: where, what: "blank page" });
  const toasts = page.locator(
    '.mantine-Notification-root[style*="danger"], .mantine-Notification-root[style*="-red-"]',
  );
  for (const toast of await toasts.all()) {
    problems.push({ page: where, what: `error toast: ${(await toast.innerText()).slice(0, 120)}` });
  }
}

for (const role of ROLES) {
  test(`${role}: every page in their sidebar opens and works`, async ({ page }) => {
    test.setTimeout(600_000);
    const problems: Problem[] = [];
    let current = "(login)";
    watch(page, problems, () => current);
    await routeApiDirect(page);
    const identity = getE2EIdentity(role);
    await loginAsRole(page, identity.username, identity.password);
    await page.goto("/dashboard");
    await waitForSettledScreen(page);

    // Their sidebar is the list — collapsed groups included.
    const paths = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll("nav a[href]")]
          .map((a) => a.getAttribute("href") ?? "")
          .filter((href) => href.startsWith("/")),
      ),
    ]);
    expect(paths.length, `${role} sees a sidebar`).toBeGreaterThan(0);

    for (const path of paths) {
      current = path;
      const before = problems.length;
      await page.goto(path);
      await checkScreen(page, problems, path);
      const tabs = page.locator("main").getByRole("tab");
      const count = await tabs.count();
      for (let i = 0; i < count; i += 1) {
        const tab = tabs.nth(i);
        if (!(await tab.isVisible()) || (await tab.isDisabled())) continue;
        const name = ((await tab.innerText()) || `tab ${i + 1}`).trim().slice(0, 40);
        current = `${path} › ${name}`;
        await tab.click();
        await checkScreen(page, problems, current);
      }
      // One line per page as it goes, so a hang later loses nothing.
      // biome-ignore lint/suspicious/noConsole: report output
      console.log(`CRAWLED ${role} ${path} ${JSON.stringify(problems.slice(before))}`);
    }

    // biome-ignore lint/suspicious/noConsole: report output
    console.log(`ROBUSTNESS ${role} ${JSON.stringify({ pages: paths.length, problems })}`);
    expect(problems, `${role}: problems a user would meet`).toEqual([]);
  });
}
