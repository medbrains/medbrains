/**
 * A hospital that runs only Registration and OPD, against a mocked API: a front-desk user sees
 * only those apps, a switched-off app's address says "not installed", and that app's code is
 * never downloaded. Counts the JavaScript fetched on first load and after opening Registration
 * and OPD; writes it to BRICK_LOAD_OUT (JSON) and screenshots to BRICK_SHOTS_DIR when set.
 */
import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { BRICK_MANIFESTS } from "../../../../packages/types/src/app-screens.generated";
import { installMockApi, seedMockSession } from "./mockApi";

const ON = new Set(["registration", "opd"]);
const FRONT_DESK = {
  id: "11111111-1111-1111-1111-111111111111",
  tenant_id: "22222222-2222-2222-2222-222222222222",
  username: "mock.front_desk",
  email: "mock.front_desk@medbrains.local",
  full_name: "Mock front desk",
  role: "receptionist",
  permissions: [
    "dashboard.view",
    "patients.list",
    "patients.create",
    "opd.queue.list",
    "opd.visit.create",
    "front_office.queue.list",
  ],
  field_access: {},
  disabled_modules: Object.keys(BRICK_MANIFESTS).filter((id) => !ON.has(id)),
};

/** Every script the page fetches, with its decoded size, from the moment this is called. */
function recordScripts(page: Page): { url: string; bytes: number }[] {
  const seen: { url: string; bytes: number }[] = [];
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script" || seen.some((s) => s.url === response.url())) return;
    const body = await response.body().catch(() => Buffer.alloc(0));
    seen.push({ url: response.url(), bytes: body.length });
  });
  return seen;
}

/**
 * Whether `url` is Pharmacy's page code: its source module on the dev server, or in a build
 * (`BRICK_DIST`, default `dist`) a chunk Vite's manifest names for `src/pages/pharmacy*`.
 */
function isPharmacyPage(url: string): boolean {
  const manifest = `${process.env.BRICK_DIST ?? "dist"}/.vite/manifest.json`;
  const chunks: Record<string, { file: string }> = fs.existsSync(manifest)
    ? JSON.parse(fs.readFileSync(manifest, "utf8"))
    : {};
  const files = Object.entries(chunks)
    .filter(([src]) => src.startsWith("src/pages/pharmacy"))
    .map(([, chunk]) => chunk.file);
  return url.includes("/src/pages/pharmacy") || files.some((file) => url.endsWith(file));
}

/** Saves the viewport when BRICK_SHOTS_DIR is set. */
async function shot(page: Page, name: string) {
  const dir = process.env.BRICK_SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, animations: "disabled" });
}

test("a Registration + OPD hospital loads only those apps", async ({ page }) => {
  await installMockApi(page);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: FRONT_DESK }));
  await page.route("**/api/users/me/launcher", (route) =>
    route.fulfill({
      json: {
        favourites: [],
        bricks: Object.values(BRICK_MANIFESTS).map(({ id, name }) => ({ id, name })),
      },
    }),
  );
  await page.route("**/api/users/me/work", (route) => route.fulfill({ json: { items: [] } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const scripts = recordScripts(page);
  await seedMockSession(page);
  await page.evaluate(
    (u) => localStorage.setItem("auth-storage", JSON.stringify({ state: { user: u }, version: 0 })),
    FRONT_DESK,
  );
  const total = () => ({ chunks: scripts.length, bytes: scripts.reduce((n, s) => n + s.bytes, 0) });

  await page.goto("/home");
  const apps = page.getByRole("region", { name: "Your apps" });
  await expect(apps).toContainText("Patient Registration");
  await expect(apps).toContainText("OPD / Outpatient");
  await expect(apps).not.toContainText("Pharmacy");
  await page.waitForLoadState("networkidle");
  const firstLoad = total();
  await shot(page, "launcher-reg-opd");

  // Open each app the way a person does: its launcher tile, then back through All apps.
  await apps.getByRole("link", { name: "Patient Registration" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByTestId("app-sidebar").getByRole("link", { name: "All apps" }).click();
  await page.getByRole("region", { name: "Your apps" }).getByRole("link", { name: "OPD / Outpatient" }).click();
  await expect(page).toHaveURL(/\/opd/);
  await page.waitForLoadState("networkidle");
  const afterRegOpd = total();
  await shot(page, "opd-reg-opd");

  const before = scripts.length;
  await page.goto("/pharmacy/orders/new");
  await expect(page.getByText("Pharmacy isn't part of this hospital's MedBrains")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await shot(page, "pharmacy-not-installed");
  const pharmacyCode = scripts.slice(before).filter((s) => isPharmacyPage(s.url));
  expect(pharmacyCode).toEqual([]);

  const out = process.env.BRICK_LOAD_OUT;
  if (out) fs.writeFileSync(out, JSON.stringify({ firstLoad, afterRegOpd }, null, 2));
});
