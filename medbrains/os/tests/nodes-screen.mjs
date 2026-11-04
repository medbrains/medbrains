#!/usr/bin/env node
// Drives the main machine's Nodes screen in a real browser, as an administrator would, for the
// two-machine proof. Prints what the screen shows; never talks to the API directly.
//
//   nodes-screen.mjs URL USER PASSWORD list|approve CODE|reject|remove|shot FILE
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const [url, user, password, action, argument] = process.argv.slice(2);

/** Signs in through the page. */
async function signIn(page) {
  await page.goto(`${url}/login`);
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
const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
await signIn(page);
await page.goto(`${url}/admin/machines`);
await page.getByText("Waiting to join").waitFor({ timeout: 30_000 });
await page.waitForTimeout(3_500);
if (action === "approve") {
  await page.getByTestId("btn-approve-machine").first().click();
  await page.getByTestId("input-machine-code").locator("input").first().click();
  await page.keyboard.type(argument);
  await page.getByTestId("btn-confirm-approve-machine").click();
  await page.waitForTimeout(2_000);
  const refused = await page.getByRole("dialog").getByRole("alert").allInnerTexts();
  console.log(JSON.stringify({ refused }));
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
