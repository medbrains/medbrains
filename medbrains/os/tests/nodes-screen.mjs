#!/usr/bin/env node
// Drives the main machine's Nodes screen in a real browser, as an administrator would, for the
// two-machine proof. Prints what the screen shows; never talks to the API directly.
//
//   nodes-screen.mjs URL USER PASSWORD list|approve CODE|show FILE|reject|remove|shot FILE
//
// Keeps its session in NODES_SESSION, because sign-in allows five tries a minute per address.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const [url, user, password, action, argument] = process.argv.slice(2);

/** Signs in through the page. */
async function signIn(page) {
  await page.getByLabel(/username/i).fill(user);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** What the screen says about waiting and joined machines. */
async function listed(page) {
  const waiting = await page.locator('[data-testid^="row-waiting-"]').allInnerTexts();
  const machines = await page.locator('[data-testid^="row-machine-"]').allInnerTexts();
  return { waiting, machines };
}

const browser = await chromium.launch();
const session = process.env.NODES_SESSION ?? "/tmp/nodes-session.json";
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  storageState: existsSync(session) ? session : undefined,
});
const page = await context.newPage();
await page.goto(`${url}/admin/machines`);
const ready = page.getByText("Waiting to join");
await ready.or(page.getByLabel(/username/i)).first().waitFor({ timeout: 60_000 });
if (!(await ready.isVisible())) {
  await signIn(page);
  await context.storageState({ path: session });
  await page.goto(`${url}/admin/machines`);
}
await page.getByText("Waiting to join").waitFor({ timeout: 30_000 });
await page.waitForTimeout(3_500);
if (action === "approve") {
  await page.getByTestId("btn-approve-machine").first().click();
  await page.getByTestId("input-machine-code").locator("input").first().click();
  await page.keyboard.type(argument);
  await page.getByTestId("btn-confirm-approve-machine").click();
  await page.waitForTimeout(2_000);
  const refused = await page.getByRole("dialog").getByRole("alert").allInnerTexts();
  const second = page.getByTestId("text-confirm-code");
  const confirm = (await second.count()) > 0 ? await second.innerText() : null;
  console.log(JSON.stringify({ refused, confirm }));
} else if (action === "show") {
  await page.getByTestId("btn-show-confirm-code").first().click();
  await page.getByTestId("text-confirm-code").waitFor({ timeout: 10_000 });
  console.log(JSON.stringify({ shown: await page.getByTestId("text-confirm-code").innerText() }));
  await page.screenshot({ path: argument });
} else if (action === "reject") {
  await page.getByTestId("btn-reject-machine").first().click();
  await page.waitForTimeout(1_500);
} else if (action === "remove") {
  await page.getByTestId("btn-remove-machine").first().click();
  await page.waitForTimeout(1_500);
} else if (action === "shot") {
  await page.screenshot({ path: argument, fullPage: true });
}
console.log(JSON.stringify(await listed(page), null, 1));
await browser.close();
