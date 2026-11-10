/**
 * Web app startup and shift-long memory, measured the same way every run.
 *
 * The web app also runs inside WebKitGTK on the OS screen and in the desktop
 * app, where the page's memory is the app's memory: WebKit drops compiled JS
 * at 65% of its limit and reloads the page at 100%. So this records, against
 * a production build (`vite build && vite preview`) and the real backend:
 *
 *  - JS fetched to draw the sign-in page and the first signed-in screen;
 *  - JS heap after sign-in (after a forced GC);
 *  - scripting time (CDP `ScriptDuration`) to each, and long tasks > 50 ms;
 *  - heap over a scripted shift loop (OPD queue -> patient -> case sheet ->
 *    billing -> dashboard, repeated) and its least-squares slope, which must
 *    be flat.
 *
 * Run:  make perf-web            (PERF_SHIFT_MINUTES=30 by default)
 * The sign-in is a super admin made through `POST /api/setup/users` by the
 * run's own super admin (`provisionIdentity`), never a stored credential.
 * CDP metrics exist only in Chromium; in WebKit the run records the JS bytes
 * and long tasks and says the rest is unavailable.
 */

import { writeFileSync } from "node:fs";
import { type CDPSession, type Page, expect } from "@playwright/test";
import { test } from "../fixtures/identity";
import { authHeaders, BACKEND_URL, type Identity } from "../helpers/identities";
import { installMockApi, seedMockSession } from "../mock/mockApi";

const SHIFT_MINUTES = Number(process.env.PERF_SHIFT_MINUTES ?? "30");
const MOCK = process.env.PERF_MOCK === "1";
// Screens the mocked API can draw (it has no billing or case-sheet data).
const MOCK_LOOP = ["/opd", "/patients", "/ipd", "/lab", "/pharmacy", "/dashboard"];
const SETTLE_MS = 1_500;
const MS_PER_MINUTE = 60_000;
const KB = 1024;

interface Snapshot {
  scriptMs: number | null;
  heapKb: number | null;
  jsKb: number;
  longTasks: number;
  longTaskMs: number;
}

/** Counts long tasks from the very first script, before the app's own code runs. */
async function installLongTaskObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store = { count: 0, total: 0 };
    (window as unknown as { __perfLongTasks: typeof store }).__perfLongTasks = store;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          store.count += 1;
          store.total += entry.duration;
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // WebKit has no longtask entries; the counters stay at zero.
    }
  });
}

/** Sums the bytes of every script response the page receives (transfer size when known). */
function trackScriptBytes(page: Page): () => number {
  let bytes = 0;
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    const sizes = await response.request().sizes().catch(() => null);
    bytes += sizes?.responseBodySize ?? 0;
  });
  return () => bytes;
}

/** Forces a GC and reads the used JS heap and total script time, or nulls outside Chromium. */
async function readCdp(cdp: CDPSession | null) {
  if (!cdp) return { scriptMs: null, heapKb: null };
  await cdp.send("HeapProfiler.collectGarbage");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const metric = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return { scriptMs: Math.round(metric("ScriptDuration") * 1000), heapKb: Math.round(usedSize / KB) };
}

/** One reading of every metric at this moment. */
async function snapshot(page: Page, cdp: CDPSession | null, jsBytes: () => number) {
  const { scriptMs, heapKb } = await readCdp(cdp);
  const tasks = await page.evaluate(
    () => (window as unknown as { __perfLongTasks: { count: number; total: number } }).__perfLongTasks,
  );
  return {
    scriptMs,
    heapKb,
    jsKb: Math.round(jsBytes() / KB),
    longTasks: tasks.count,
    longTaskMs: Math.round(tasks.total),
  } satisfies Snapshot;
}

/** Navigates inside the SPA (no reload), the way a sidebar link does, and lets it settle. */
async function goInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
}

/** Least-squares slope of heap (kB) against minutes. */
function slopeKbPerMinute(points: Array<[number, number]>): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  const num = points.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const den = points.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

/** The first id in a list response, whichever envelope the endpoint uses. */
function firstId(body: unknown, key = "id"): string | null {
  const record = body as { data?: unknown; items?: unknown; patients?: unknown };
  const rows = Array.isArray(body) ? body : (record.data ?? record.items ?? record.patients);
  const first = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  return typeof first?.[key] === "string" ? (first[key] as string) : null;
}

interface SignedIn {
  signInPage: Snapshot;
  patientId: string | null;
  encounterId: string | null;
}

/** Signs in through the real form as `admin`, measuring the sign-in page first; returns ids to open. */
async function signInForReal(
  page: Page,
  admin: Identity,
  measure: () => Promise<Snapshot>,
): Promise<SignedIn> {
  const headers = authHeaders(admin.session);
  const get = (path: string) => page.request.get(`${BACKEND_URL}/api${path}`, { headers });
  const tenant = await (await get("/setup/tenant")).json();
  const patients = await get("/patients?per_page=1");
  const encounters = await get("/opd/encounters?per_page=1");

  await page.goto(`/login?hospital=${encodeURIComponent(tenant.code ?? "")}`);
  await expect(page.getByRole("textbox", { name: "Username", exact: true })).toBeVisible({ timeout: 30_000 });
  const signInPage = await measure();
  await page.getByRole("textbox", { name: "Username", exact: true }).fill(admin.username);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  return {
    signInPage,
    patientId: patients.ok() ? firstId(await patients.json()) : null,
    encounterId: encounters.ok() ? firstId(await encounters.json()) : null,
  };
}

/**
 * PERF_MOCK=1: the mocked API of e2e/mock (no backend). The session is seeded,
 * not signed in, and screens draw mock data, so the numbers are indicative;
 * the real run is the one to record.
 */
async function signInMocked(page: Page, measure: () => Promise<Snapshot>): Promise<SignedIn> {
  await installMockApi(page);
  await page.goto("/login");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const signInPage = await measure();
  await seedMockSession(page);
  await page.goto("/dashboard");
  return { signInPage, patientId: null, encounterId: null };
}

test.describe("web performance", () => {
  test.describe.configure({ timeout: (SHIFT_MINUTES + 5) * MS_PER_MINUTE });

  test("startup and shift loop", async ({ page, asRole, browserName }) => {
    await installLongTaskObserver(page);
    const jsBytes = trackScriptBytes(page);
    const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
    await cdp?.send("Performance.enable");
    const measure = () => snapshot(page, cdp, jsBytes);

    const { signInPage, patientId, encounterId } = MOCK
      ? await signInMocked(page, measure)
      : await signInForReal(page, await asRole("super_admin"), measure);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    const afterSignIn = await measure();

    const loop = MOCK
      ? MOCK_LOOP
      : [
          "/opd",
          patientId ? `/patients/${patientId}` : "/patients",
          encounterId ? `/opd/encounters/${encounterId}` : "/opd",
          "/billing",
          "/dashboard",
        ];
    const start = Date.now();
    const heap: Array<[number, number]> = [];
    let laps = 0;
    while (Date.now() - start < SHIFT_MINUTES * MS_PER_MINUTE) {
      for (const path of loop) await goInApp(page, path);
      laps += 1;
      const { heapKb } = await readCdp(cdp);
      if (heapKb !== null) heap.push([(Date.now() - start) / MS_PER_MINUTE, heapKb]);
    }
    const afterShift = await snapshot(page, cdp, jsBytes);
    // The first laps fill caches every later lap reuses; the slope is judged after them.
    const warm = heap.slice(Math.min(3, Math.floor(heap.length / 3)));

    const result = {
      browser: browserName,
      api: MOCK ? "mock" : "real",
      shiftMinutes: SHIFT_MINUTES,
      laps,
      signInPage,
      afterSignIn,
      afterShift,
      heapSlopeKbPerMin: Math.round(slopeKbPerMinute(warm) * 10) / 10,
      heap,
    };
    const json = JSON.stringify(result, null, 2);
    console.log(json);
    if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, json);
    await test.info().attach("perf.json", { body: json, contentType: "application/json" });
  });
});
