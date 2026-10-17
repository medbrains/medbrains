/**
 * The IPD billing desk closes a stay (#292): the discharge checklist shows the
 * stay's charges by department with nothing outstanding, the clerk issues the
 * final bill, applies the advance to it, and refunds what the advance had
 * left over.
 */
import { api } from "../helpers/api";
import { admitToIpd, createPatientApi, freshWardBeds } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("the billing desk issues the final bill and refunds the unused advance", async ({ hospital }) => {
  test.setTimeout(180_000);
  const patient = await createPatientApi(hospital.admin);
  const [bed] = await freshWardBeds(hospital.admin, 1);
  const admissionId = await admitToIpd(hospital.admin, { patientId: patient.id, bedId: bed?.bed_id });
  const admission = await api<{ encounter_id: string }>(hospital.admin, "GET", `/api/ipd/admissions/${admissionId}`);
  const invoice = await api<{ id: string }>(hospital.admin, "POST", "/api/billing/invoices", {
    patient_id: patient.id,
    encounter_id: admission.encounter_id,
    admission_id: admissionId,
  });
  await api(hospital.admin, "POST", `/api/billing/invoices/${invoice.id}/items`, {
    charge_code: "BED-GEN",
    description: "General ward bed-day",
    source: "manual",
    quantity: 2,
    unit_price: 1500,
  });
  await api(hospital.admin, "POST", "/api/billing/advances", {
    patient_id: patient.id,
    encounter_id: admission.encounter_id,
    amount: 5000,
    payment_mode: "cash",
  });

  const page = await hospital.asAdmin();
  await page.goto(`/ipd/admissions/${admissionId}#billing-tab`);
  const checklist = page.getByRole("region", { name: "Discharge bill checklist" });
  await expect(checklist.getByRole("listitem", { name: "Every order is on the bill" })).toContainText(
    "Every order is on the bill",
  );
  await expect(checklist).toContainText("Refund due");
  await checklist.getByRole("button", { name: "Issue final bill" }).click();
  await expect(checklist.getByText("Final bill issued", { exact: true })).toBeVisible();

  await checklist.getByRole("button", { name: "Apply advance" }).click();
  const refund = checklist.getByRole("button", { name: /^Refund ₹2,000/ });
  await expect(refund).toBeVisible();
  await refund.click();
  await expect(page.getByText("The unused advance has been refunded.")).toBeVisible();
  await expect(checklist.getByRole("listitem", { name: "Advance applied" })).toContainText("₹0.00");
});
