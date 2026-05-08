import { expect, test } from "@playwright/test";
import { BACKEND_URL, getAuthToken, navigateTo, routeApiDirect } from "../helpers";

test.describe("Patient edit route", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("loads the edit form for an existing patient", async ({ page, request }) => {
    const { cookies } = await getAuthToken(request);
    const resp = await request.get(`${BACKEND_URL}/api/patients?per_page=1`, {
      headers: { Cookie: cookies },
    });
    expect(resp.ok()).toBeTruthy();

    const body = (await resp.json()) as { patients?: Array<{ id: string }> };
    const patient = body.patients?.[0];
    test.skip(!patient, "no seeded patient available");

    await navigateTo(page, `/patients/${patient.id}/edit`);

    await expect(
      page.getByText("Update demographic, contact, and clinical-safety fields"),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Prefix")).toBeVisible();
  });
});
