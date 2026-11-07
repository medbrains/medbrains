#!/usr/bin/env node
// Signs in through a real browser, by way of the front, and reports what a person would depend on:
// how long the page took, whether its WebSockets opened, and what the responses looked like.
//
//   front-browser.mjs URL USER PASSWORD [LOADS]
//
// Prints one JSON line. LOADS repeats the uncached load of the sign-in page and gives each time.
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const [url, user, password, loads = "3"] = process.argv.slice(2);

/** Loads the sign-in page in a new, empty browser profile and returns the time to `load`. */
async function coldLoad(browser) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(`${url}/login`, { waitUntil: "load", timeout: 90_000 });
  const took = Date.now() - started;
  await context.close();
  return took;
}

/** Signs in through the page and watches every WebSocket it opens. */
async function signIn(browser) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const sockets = [];
  page.on("websocket", (socket) => {
    const entry = { url: new URL(socket.url()).pathname, frames: 0, closed: false };
    sockets.push(entry);
    socket.on("framereceived", () => { entry.frames += 1; });
    socket.on("close", () => { entry.closed = true; });
  });
  const encodings = new Set();
  page.on("response", (response) => {
    const encoding = response.headers()["content-encoding"];
    if (encoding) encodings.add(encoding);
  });
  await page.goto(`${url}/login`, { waitUntil: "load", timeout: 90_000 });
  await page.getByLabel(/username/i).fill(user);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  // The notification stream opens once the shell has settled.
  await page.waitForTimeout(15_000);
  const result = { path: new URL(page.url()).pathname, sockets, encodings: [...encodings] };
  await context.close();
  return result;
}

const browser = await chromium.launch();
const times = [];
for (let index = 0; index < Number(loads); index += 1) {
  times.push(await coldLoad(browser));
}
const signedIn = await signIn(browser);
await browser.close();
console.log(JSON.stringify({ load_ms: times, ...signedIn }));
