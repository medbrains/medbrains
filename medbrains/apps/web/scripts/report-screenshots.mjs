// Light and dark screenshots of a generated test report, for the PR of any Allure upgrade
// (the MedBrains theme leans on the report's CSS variable names, so an upgrade can undo it).
//
//   node scripts/report-screenshots.mjs allure-report screenshots/
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const [reportDir = "allure-report", outDir = "report-screenshots"] = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

/** Serves the report directory; the report fetches its data, so file:// does not work. */
const server = createServer(async (req, res) => {
  const file = path.join(reportDir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  const target = file.endsWith(path.sep) ? path.join(file, "index.html") : file;
  const body = await readFile(target).catch(() => null);
  if (!body) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": types[path.extname(target)] ?? "application/octet-stream" });
  res.end(body);
}).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
for (const colorScheme of ["light", "dark"]) {
  const page = await browser.newPage({ colorScheme, viewport: { width: 1440, height: 900 } });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(outDir, `report-${colorScheme}.png`), fullPage: true });
  await page.close();
}
await browser.close();
server.close();
console.log(`screenshots in ${outDir}`);
