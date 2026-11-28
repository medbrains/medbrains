/**
 * Brick panels on the patient record against a mocked API: a tab another brick plugs in
 * (Lab, Radiology, Billing) shows only while its brick is on and the server granted its
 * permission, and is left out otherwise, never greyed. Screenshots land in
 * BRICK_PANEL_SHOTS_DIR when set (the PR's pictures).
 */
import { expect, type Page, test } from "@playwright/test";
import { installMockApi, seedMockSession } from "./mockApi";

const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const DOCTOR = {
  role: "doctor",
  permissions: ["dashboard.view", "patients.view", "patients.list", "lab.orders.list"],
};

/** Signs the doctor in with `disabled` bricks off and opens the patient record on `tab`. */
async function openRecord(page: Page, disabled: string[], tab: string) {
  const user = {
    id: "11111111-1111-1111-1111-111111111111",
    tenant_id: "22222222-2222-2222-2222-222222222222",
    username: "mock.doctor",
    email: "mock.doctor@medbrains.local",
    full_name: "Mock doctor",
    ...DOCTOR,
    field_access: {},
    disabled_modules: disabled,
  };
  await installMockApi(page);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: user }));
  await page.route(`**/api/patients/${PATIENT_ID}`, (route) =>
    route.fulfill({
      json: {
        id: PATIENT_ID,
        uhid: "UH-0001",
        first_name: "Asha",
        last_name: "Rao",
        date_of_birth: "1980-01-01",
        gender: "female",
        category: "general",
        financial_class: "self_pay",
        is_deceased: false,
      },
    }),
  );
  await page.route(`**/api/patients/${PATIENT_ID}/context`, (route) =>
    route.fulfill({
      json: {
        patient_id: PATIENT_ID,
        drug_allergies: [],
        known_allergies: [],
        no_known_allergies: true,
        pending_consents: [],
      },
    }),
  );
  await seedMockSession(page);
  await page.evaluate(
    (u) => localStorage.setItem("auth-storage", JSON.stringify({ state: { user: u }, version: 0 })),
    user,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/patients/${PATIENT_ID}#${tab}`);
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
}

/** Saves the viewport when BRICK_PANEL_SHOTS_DIR is set. */
async function shot(page: Page, name: string) {
  const dir = process.env.BRICK_PANEL_SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, animations: "disabled" });
}

test("a doctor holding lab.orders.list gets Lab's tab and no Imaging or Billing", async ({
  page,
}) => {
  await openRecord(page, [], "lab");
  await expect(page.getByRole("tab", { name: "Lab Orders", selected: true })).toBeVisible();
  // The tab's body is Lab's own chunk, downloaded only now.
  await expect(page.getByText("No lab orders found.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Imaging" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Billing" })).toHaveCount(0);
  await shot(page, "doctor-lab-tab");
});

test("with Lab switched off the same doctor gets no Lab tab", async ({ page }) => {
  await openRecord(page, ["lab"], "visits");
  await expect(page.getByRole("tab", { name: "Lab Orders" })).toHaveCount(0);
  await shot(page, "doctor-lab-off");
});
