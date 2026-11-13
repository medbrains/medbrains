#!/usr/bin/env node
// Signs in through the real page by way of the front and opens Patients, as a person would: the proof that
// the app still works on a hardened image. Fails on a 5xx, a page error, or a Patients page that never shows.
//
//   patients-journey.mjs URL USER PASSWORD
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const [url, user, password] = process.argv.slice(2);

/** Signs in, opens Patients, and returns what went wrong, if anything. */
async function journey(browser) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const problems = [];
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  await page.goto(`${url}/login`, { waitUntil: "load", timeout: 90_000 });
  await page.getByLabel(/username/i).fill(user);
  await page.getByLabel(/password/i).first().fill(password);
  // The local form's own button, not "Sign in with" the identity provider.
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.goto(`${url}/patients`, { waitUntil: "load", timeout: 60_000 });
  await page.getByRole("heading", { name: /patients/i }).first().waitFor({ timeout: 60_000 });
  const path = new URL(page.url()).pathname;
  await context.close();
  if (path !== "/patients") problems.push(`ended on ${path}`);
  return problems;
}

const browser = await chromium.launch();
try {
  const problems = await journey(browser);
  console.log(JSON.stringify({ ok: problems.length === 0, problems }));
  process.exitCode = problems.length === 0 ? 0 : 1;
} finally {
  await browser.close();
}
