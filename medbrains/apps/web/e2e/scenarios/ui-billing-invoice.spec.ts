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
import { loginAsRoleApi } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  addBillingItem,
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

  test("billing clerk raises a draft invoice for a visit handed to billing", async ({
    page,
    request,
  }) => {
    const identity = getE2EIdentity("billing_clerk");
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    await createEncounter(doctorCtx, patient.id, { departmentId: opdDept.id });

    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/billing");
    await page.getByRole("button", { name: /New Invoice/i }).first().click();
    const modal = page.getByRole("dialog", { name: "Create Invoice" });

    // The clerk finds the patient because the visit reached billing.
    await modal.getByRole("textbox", { name: "Patient" }).fill(patient.uhid);
    await page.getByRole("option", { name: new RegExp(patient.first_name, "i") }).click();
    // The visit is picked from the patient's visits, never typed as an id.
    await modal.getByRole("textbox", { name: "Visit" }).click();
    await page.getByRole("option", { name: /OPD/ }).first().click();
    await modal.getByRole("button", { name: "Create Draft Invoice" }).click();

    await expect(modal).toBeHidden({ timeout: 10_000 });
    await expect(
      page.getByRole("row", { name: new RegExp(patient.first_name, "i") }),
    ).toBeVisible({ timeout: 12_000 });
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

  test("opening an invoice from the list shows its detail page", async ({
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

    // Open the invoice from its row
    const row = page.getByRole("row", {
      name: new RegExp(patient.first_name, "i"),
    });
    await expect(row).toBeVisible({ timeout: 12_000 });
    await row.getByRole("button", { name: /^Open invoice/ }).click();

    // Route: /billing/invoices/:invoiceId
    await expect(page).toHaveURL(
      new RegExp(`billing/invoices/${invoiceId}`, "i"),
      { timeout: 10_000 },
    );
  });

  test("Collect button present on an issued invoice detail page", async ({
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
    // A ₹0 invoice settles on issue; a charge leaves a balance to collect.
    await addBillingItem(billingCtx, invoiceId, { unitPrice: 500 });
    await issueInvoice(billingCtx, invoiceId);

    await loginAsRole(page, billingIdentity.username, billingIdentity.password);
    // Navigate directly to invoice detail page
    await navigateTo(page, `/billing/invoices/${invoiceId}`);

    await expect(
      page.locator("#billing-payments").getByRole("button", { name: "Collect" }),
    ).toBeVisible({ timeout: 12_000 });
  });
});
