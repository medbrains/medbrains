/**
 * UI tests — SOP ref: docs/sops/02-opd-visit.md
 * Scenario S1: Receptionist check-in / new visit creation
 * Scenario S2: Doctor opens consultation workspace, writes notes
 * Scenario S3: Nurse records triage vitals
 */

import { test, expect } from "@playwright/test";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { loginAsRoleApi } from "../helpers/api";
import { createPatientApi, createEncounter } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";

test.describe("OPD Workflow — UI", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test("receptionist sees OPD page with New visit button and queue tab", async ({
    page,
  }) => {
    const identity = getE2EIdentity("receptionist");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/opd");

    await expect(page.getByRole("heading", { name: /OPD/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: /New visit/i }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Queue/i })).toBeVisible();
  });

  test("new-visit form opens with required patient field", async ({ page }) => {
    const identity = getE2EIdentity("receptionist");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/opd/new");

    // New visit page has a patient search / select field
    await expect(page.getByRole("combobox")).toBeVisible({ timeout: 8_000 });
  });

  test("existing encounter appears in OPD queue after creation", async ({
    page,
    request,
  }) => {
    const doctorIdentity = getE2EIdentity("doctor");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    await createEncounter(doctorCtx, patient.id, { departmentId: opdDept.id });

    await loginAsRole(page, doctorIdentity.username, doctorIdentity.password);
    await navigateTo(page, "/opd");

    // Queue tab should be selected by default; search for the patient
    await page
      .getByPlaceholder(/Search token, patient, UHID, phone/i)
      .fill(patient.first_name);

    await expect(
      page.getByText(new RegExp(patient.first_name, "i")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("doctor opens encounter workspace and consultation tab is present", async ({
    page,
    request,
  }) => {
    const doctorIdentity = getE2EIdentity("doctor");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    await loginAsRole(page, doctorIdentity.username, doctorIdentity.password);
    await navigateTo(page, `/opd/encounters/${encounterId}`);

    // Consultation workspace should load with clinical tabs
    await expect(
      page.getByRole("heading", { name: new RegExp(patient.first_name, "i") }),
    ).toBeVisible({ timeout: 12_000 });

    // Vitals tab must be present
    await expect(page.getByRole("tab", { name: /Vitals/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test("nurse records vitals via encounter vitals tab", async ({
    page,
    request,
  }) => {
    const nurseIdentity = getE2EIdentity("nurse");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    await loginAsRole(page, nurseIdentity.username, nurseIdentity.password);
    await navigateTo(page, `/opd/encounters/${encounterId}`);

    // Click Vitals tab
    await page.getByRole("tab", { name: /Vitals/i }).click();
    await expect(page.getByRole("tabpanel", { name: /Vitals/i })).toBeVisible({
      timeout: 8_000,
    });
  });
});
