import { test, expect, type Page } from "@playwright/test";
import { uniquePatient, type PatientFormData } from "./fixtures/patients";
import {
  browserCookiesFromLogin,
  getE2EIdentity,
  loginForSession,
} from "./helpers/e2e-identities";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

/**
 * Intercept /api/* requests at the Playwright network layer and forward
 * them directly to the backend, bypassing Vite proxy issues in Playwright.
 */
async function routeApiDirect(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith("/api/") || url.pathname === "/api",
    async (route) => {
      const url = new URL(route.request().url());
      const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      try {
        const response = await route.fetch({ url: backendUrl });
        await route.fulfill({ response });
      } catch {
        // Page navigated away while request was in flight
      }
    },
  );
}

/** Navigate to /patients, re-authenticating inline if the session expired. */
async function ensureOnPatientsPage(page: Page) {
  await page.goto("/patients");

  if (page.url().includes("/login")) {
    const admin = getE2EIdentity("super_admin");
    const session = await loginForSession(
      page.request,
      admin.username,
      admin.password,
    );
    await page.evaluate(
      (user) => {
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({ state: { user }, version: 0 }),
        );
      },
      session.user,
    );
    const cookies = browserCookiesFromLogin(session);
    if (cookies.length > 0) {
      await page.context().addCookies(cookies);
    }
    await page.goto("/patients");
  }

  await expect(page.getByText("Registration & records")).toBeVisible({
    timeout: 10_000,
  });
}

/** Open the registration drawer (full or quick) via the header button. */
async function openRegisterDrawer(page: Page, quick = false) {
  if (quick) {
    await page.getByRole("button", { name: "Quick Register" }).click();
  } else {
    await page
      .getByRole("button", { name: "Register Patient" })
      .first()
      .click();
  }

  const drawer = page.locator('[role="dialog"]');
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Register" }),
  ).toBeVisible({ timeout: 10_000 });
  return drawer;
}

/** Fill the registration form with patient data. */
async function fillRegistrationForm(
  drawer: ReturnType<Page["locator"]>,
  patient: PatientFormData,
) {
  await drawer.getByLabel("First Name").fill(patient.firstName);
  await drawer.getByLabel(/Last Name/).fill(patient.lastName);
  await drawer.getByLabel(/Phone Primary/).fill(patient.phone);
}

test.describe("Patient Registration", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
    await ensureOnPatientsPage(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("should display the patients page with header and actions", async ({
    page,
  }) => {
    await expect(page.getByText("Registration & records")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Register Patient" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quick Register" }),
    ).toBeVisible();

    await expect(
      page.getByPlaceholder("Search by UHID, name, or phone..."),
    ).toBeVisible();
  });

  test("should open the full registration drawer with form fields", async ({
    page,
  }) => {
    const drawer = await openRegisterDrawer(page);

    await expect(drawer.getByText("Register Patient")).toBeVisible();

    await expect(drawer.getByLabel("First Name")).toBeVisible();
    await expect(drawer.getByLabel(/Last Name/)).toBeVisible();
    await expect(drawer.getByLabel(/Phone Primary/)).toBeVisible();

    await expect(
      drawer.getByRole("button", { name: "Register" }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Cancel" }),
    ).toBeVisible();
  });

  test("should open the quick registration drawer", async ({ page }) => {
    const drawer = await openRegisterDrawer(page, true);
    await expect(drawer.getByText("Quick Registration")).toBeVisible();
    await expect(drawer.getByLabel("First Name")).toBeVisible();
  });

  test("should close registration drawer on cancel", async ({ page }) => {
    const drawer = await openRegisterDrawer(page);
    await drawer.getByRole("button", { name: "Cancel" }).click();
    await expect(drawer).not.toBeVisible({ timeout: 5_000 });
  });

  test("should register a patient via form fill and show in list", async ({
    page,
  }) => {
    const patient = uniquePatient();
    const drawer = await openRegisterDrawer(page);

    await fillRegistrationForm(drawer, patient);
    await drawer.getByRole("button", { name: "Register" }).click();

    // Drawer should close on success
    await expect(drawer).not.toBeVisible({ timeout: 10_000 });

    // Patient should appear in the list
    await expect(page.getByText(patient.firstName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("should search for a registered patient", async ({ page }) => {
    // Register a patient first
    const patient = uniquePatient();
    const drawer = await openRegisterDrawer(page);
    await fillRegistrationForm(drawer, patient);
    await drawer.getByRole("button", { name: "Register" }).click();
    await expect(drawer).not.toBeVisible({ timeout: 10_000 });

    // Search by name
    const searchInput = page.getByPlaceholder(
      "Search by UHID, name, or phone...",
    );
    await searchInput.fill(patient.firstName);

    await expect(page.getByText(patient.firstName)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(patient.lastName)).toBeVisible();
  });

  test("should view patient details in the detail drawer", async ({
    page,
  }) => {
    // Register a patient first
    const patient = uniquePatient();
    const drawer = await openRegisterDrawer(page);
    await fillRegistrationForm(drawer, patient);
    await drawer.getByRole("button", { name: "Register" }).click();
    await expect(drawer).not.toBeVisible({ timeout: 10_000 });

    // Wait for patient to appear in list
    await expect(page.getByText(patient.firstName)).toBeVisible({
      timeout: 10_000,
    });

    // Click the view action button
    const row = page.locator("tr", { hasText: patient.firstName });
    await row.locator("button").first().click();

    // Detail drawer should open
    const detailDrawer = page.locator('[role="dialog"]');
    await expect(detailDrawer).toBeVisible({ timeout: 5_000 });

    // Should show patient info
    await expect(detailDrawer.getByText(patient.phone)).toBeVisible({
      timeout: 5_000,
    });

    // Should have sub-resource tabs
    for (const tab of [
      "Overview",
      "IDs",
      "Addresses",
      "Contacts",
      "Allergies",
      "Consents",
    ]) {
      await expect(
        detailDrawer.getByRole("tab", { name: tab }),
      ).toBeVisible();
    }
  });

  test("should navigate through detail drawer tabs", async ({ page }) => {
    // Register a patient first
    const patient = uniquePatient();
    const drawer = await openRegisterDrawer(page);
    await fillRegistrationForm(drawer, patient);
    await drawer.getByRole("button", { name: "Register" }).click();
    await expect(drawer).not.toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(patient.firstName)).toBeVisible({
      timeout: 10_000,
    });

    // Open detail drawer
    const row = page.locator("tr", { hasText: patient.firstName });
    await row.locator("button").first().click();

    const detailDrawer = page.locator('[role="dialog"]');
    await expect(detailDrawer).toBeVisible({ timeout: 5_000 });

    // Click through tabs
    await detailDrawer.getByRole("tab", { name: "IDs" }).click();
    await expect(
      detailDrawer.getByText("No identifiers recorded"),
    ).toBeVisible({ timeout: 5_000 });

    await detailDrawer.getByRole("tab", { name: "Allergies" }).click();
    await expect(
      detailDrawer.getByText("No allergies recorded"),
    ).toBeVisible({ timeout: 5_000 });

    await detailDrawer.getByRole("tab", { name: "Contacts" }).click();
    await expect(
      detailDrawer.getByText("No contacts recorded"),
    ).toBeVisible({ timeout: 5_000 });
  });
});
