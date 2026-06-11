/**
 * UI tests — SOP ref: docs/sops/07-billing-payments.md
 * Scenario S1: Billing clerk sees Billing page and New Invoice button
 * Scenario S2: Invoice creation drawer / modal opens with patient field
 * Scenario S3: Existing invoice appears in invoice list
 * Scenario S4: Invoice detail page accessible from list
 */

import { test, expect } from "@playwright/test";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { loginAsRoleApi, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createInvoice,
  issueInvoice,
} from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";

test.describe("Billing Invoice — UI", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test("billing clerk sees Billing page with New Invoice button and Invoices tab", async ({
    page,
  }) => {
    const identity = getE2EIdentity("billing_clerk");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/billing");

    await expect(
      page.getByRole("heading", { name: /Billing/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /New Invoice/i }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Invoices/i })).toBeVisible();
  });

  test("New Invoice button opens invoice creation modal with patient field", async ({
    page,
  }) => {
    const identity = getE2EIdentity("billing_clerk");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/billing");

    await page.getByRole("button", { name: /New Invoice/i }).first().click();

    // Modal / drawer should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 8_000 });

    // Patient selection or search field must be present
    await expect(modal.getByRole("combobox").first()).toBeVisible();
  });

  test("issued invoice appears in billing invoice list", async ({
    page,
    request,
  }) => {
    const billingIdentity = getE2EIdentity("billing_clerk");
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });
    const invoiceId = await createInvoice(billingCtx, {
      patientId: patient.id,
      encounterId,
    });
    await issueInvoice(billingCtx, invoiceId);

    await loginAsRole(page, billingIdentity.username, billingIdentity.password);
    await navigateTo(page, "/billing");

    // Patient name should appear in the invoice list
    await expect(
      page.getByText(new RegExp(patient.first_name, "i")),
    ).toBeVisible({ timeout: 12_000 });
  });

  test("clicking invoice row opens invoice detail page", async ({
    page,
    request,
  }) => {
    const billingIdentity = getE2EIdentity("billing_clerk");
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });
    const invoiceId = await createInvoice(billingCtx, {
      patientId: patient.id,
      encounterId,
    });

    await loginAsRole(page, billingIdentity.username, billingIdentity.password);
    await navigateTo(page, "/billing");

    // Click the row matching the patient
    const row = page.getByRole("row", {
      name: new RegExp(patient.first_name, "i"),
    });
    await expect(row).toBeVisible({ timeout: 12_000 });
    await row.click();

    // Route: /billing/invoices/:invoiceId
    await expect(page).toHaveURL(
      new RegExp(`billing/invoices/${invoiceId}`, "i"),
      { timeout: 10_000 },
    );
  });

  test("Record Payment button present on an issued invoice detail page", async ({
    page,
    request,
  }) => {
    const billingIdentity = getE2EIdentity("billing_clerk");
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });
    const invoiceId = await createInvoice(billingCtx, {
      patientId: patient.id,
      encounterId,
    });
    await issueInvoice(billingCtx, invoiceId);

    await loginAsRole(page, billingIdentity.username, billingIdentity.password);
    // Navigate directly to invoice detail page
    await navigateTo(page, `/billing/invoices/${invoiceId}`);

    await expect(
      page.getByRole("button", { name: /Record Payment/i }),
    ).toBeVisible({ timeout: 12_000 });
  });
});
