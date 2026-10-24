import { chromium } from "@playwright/test";
const out = process.argv[2];
const b = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  await ctx.addInitScript((s) => { try { localStorage.setItem("mantine-color-scheme-value", s); } catch {} }, scheme);
  const p = await ctx.newPage();
  for (const path of ["/portal", "/kiosk/check-in", "/no-such-page"]) {
    await p.goto(`http://127.0.0.1:4417${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/mascot${path.replace(/\//g, "-")}-${scheme}.png` });
  }
  await ctx.close();
}
await b.close();
