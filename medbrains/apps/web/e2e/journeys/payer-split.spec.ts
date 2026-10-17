/**
 * The TPA desk splits a discharge bill (#294): the hospital's non-payables
 * list (edited on the billing settings screen) sends the admission kit and
 * the attendant's water to the patient, co-pay and deductible come off the
 * insurer, the clerk moves one more line with a reason, writes the split to
 * the claim and prints the patient's share.
 */
import { api } from "../helpers/api";
import {
  addBillingItem,
  createInvoice,
  createPatientApi,
  issueInvoice,
} from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("the TPA desk splits a bill between insurer and patient on one screen", async ({ hospital }) => {
  test.setTimeout(150_000);
  const admin = hospital.admin;
  const tag = Date.now().toString(36).slice(-5);
  // This test's list is restored afterwards; start from the IRDAI default.
  const defaults = await api<{ rules: unknown[] }>(admin, "GET", "/api/billing/non-payables");
  await hospital.setting("billing", "non_payables", defaults.rules);

  // The hospital adds its own item to the list, on the settings screen.
  const adminPage = await hospital.as("hospital_admin");
  await adminPage.goto("/billing");
  await adminPage.getByRole("tab", { name: "Settings" }).click();
  const add = adminPage.getByRole("form", { name: "Add a non-payable item" });
  await add.getByRole("textbox", { name: "Value" }).fill(`water ${tag}`);
  await add.getByRole("textbox", { name: "Reason" }).fill("Attendant consumable");
  await add.getByRole("button", { name: "Add" }).click();
  await add.getByRole("button", { name: "Save list" }).click();
  await expect(adminPage.getByText("Non-payables list saved")).toBeVisible();

  const patient = await createPatientApi(admin);
  const invoiceId = await createInvoice(admin, { patientId: patient.id });
  for (const [description, unitPrice] of [
    ["Room rent — semi-private (3 days)", 6000],
    ["Admission kit", 500],
    [`Mineral water ${tag}`, 100],
    ["Complete blood count", 400],
  ] as const) {
    await addBillingItem(admin, invoiceId, { description, unitPrice, chargeCode: "MISC" });
  }
  await issueInvoice(admin, invoiceId);
  await api(admin, "POST", "/api/billing/insurance-claims", {
    invoice_id: invoiceId,
    patient_id: patient.id,
    insurance_provider: "Star Health",
    tpa_name: "Medi Assist",
    claim_type: "cashless",
    co_pay_percent: 10,
    deductible_amount: 1000,
  });

  const page = await hospital.as("billing_clerk");
  await page.goto(`/billing/invoices/${invoiceId}`);
  await page.getByRole("button", { name: "Payer split" }).click();
  const split = page.getByLabel("Payer split");
  await expect(split.getByText("Star Health · TPA Medi Assist")).toBeVisible();
  const row = (text: string) => split.getByRole("row").filter({ hasText: text });
  await expect(row("Admission kit")).toContainText("IRDAI List I");
  await expect(row(`Mineral water ${tag}`)).toContainText("Attendant consumable");
  // Insurer items 6,400; co-pay 640; deductible 1,000.
  await expect(split.getByText("₹4,760.00")).toBeVisible();

  // The policy does not cover this test: the clerk moves it, saying why.
  await split.getByRole("combobox", { name: "Payer for Complete blood count" }).click();
  await page.getByRole("option", { name: "Patient", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Why" }).fill("Outpatient test, not covered");
  await dialog.getByRole("button", { name: "Move line" }).click();
  await expect(row("Complete blood count")).toContainText("Outpatient test, not covered");
  // Insurer items 6,000 → claim 6,000 − 600 − 1,000.
  await expect(split.getByText("₹4,400.00")).toBeVisible();

  await split.getByRole("button", { name: "Write to claim" }).click();
  await expect(page.getByText("Written to the claim")).toBeVisible();
  const claims = await api<Array<{ invoice_id: string; claim_amount: string }>>(
    admin,
    "GET",
    `/api/billing/insurance-claims?invoice_id=${invoiceId}`,
  );
  expect(Number(claims.find((c) => c.invoice_id === invoiceId)?.claim_amount)).toBe(4400);

  await split.getByRole("button", { name: "Patient share" }).click();
  const [rendered] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/documents/render")),
    page.context().waitForEvent("page"),
    page.getByRole("menuitem", { name: "Generate & open PDF" }).click(),
  ]);
  expect(rendered.status()).toBe(200);
});
