/**
 * An outage on a clinical list is shown as an outage (#5474).
 *
 * The mock API answers everything else; the list endpoints answer 503, as a
 * stopped backend behind the proxy would. Each screen must say it could not
 * load, and must not say the ward is empty, nobody is waiting, or there are no
 * beds: authz law rule 6, "a list must never render an outage as emptiness".
 */
import { expect, type Page, test } from "@playwright/test";
import { installMockApi, seedMockSession } from "./mockApi";

/** Make every request whose path starts with one of `prefixes` fail with 503. */
async function failReads(page: Page, prefixes: string[]) {
  await page.route(
    (url) => prefixes.some((prefix) => url.pathname.startsWith(prefix)),
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "service_unavailable", message: "Service unavailable" }),
      }),
  );
}

test.describe("clinical lists during an outage", () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedMockSession(page);
  });

  test("the ward grid says it did not load, not that the ward is empty", async ({ page }) => {
    await failReads(page, ["/api/care-view/ward-grid", "/api/care-view/wards/"]);
    await page.goto("/care-view");
    await page.getByRole("tab", { name: "Patient Grid" }).click();
    await expect(page.getByText("Ward patients didn't load")).toBeVisible();
    await expect(page.getByText("No admitted patients in the selected ward.")).toHaveCount(0);
  });

  test("the bed board says it did not load instead of drawing zeros", async ({ page }) => {
    await failReads(page, ["/api/ipd/bed-dashboard"]);
    await page.goto("/ipd");
    await page.getByRole("tab", { name: "Bed Dashboard" }).click();
    await expect(page.getByText("Bed counts didn't load")).toBeVisible();
    await expect(page.getByText("Beds didn't load")).toBeVisible();
    await expect(page.getByText("No beds found.")).toHaveCount(0);
  });

  test("the vitals counter says the queue did not load, not that nobody waits", async ({
    page,
  }) => {
    await failReads(page, ["/api/opd/queue"]);
    await page.goto("/opd");
    await page.getByRole("tab", { name: "Vitals counter" }).click();
    await expect(page.getByText("The queue didn't load")).toBeVisible();
    await expect(page.getByText("Nobody is waiting")).toHaveCount(0);
    await expect(page.getByText(/waiting for vitals/)).toHaveCount(0);
  });

  test("the lab worklist says it did not load, not that there are no orders", async ({
    page,
  }) => {
    await failReads(page, ["/api/lab/orders"]);
    await page.goto("/lab");
    await expect(page.getByText("This didn't load").first()).toBeVisible();
    await expect(page.getByText("No data found")).toHaveCount(0);
  });
});
