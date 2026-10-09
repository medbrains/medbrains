/**
 * A home visit has its own case sheet: from the day's round the visit's
 * sheet opens, the nursing note is written and signed there, and it is on
 * the patient's record in home care (RFC-MODULE-clinical-notes, home care).
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a home visit's nursing note is signed on its case sheet", async ({ hospital }) => {
  const patient = await createPatientApi(hospital.admin);
  const today = new Date().toISOString().slice(0, 10);
  await api(hospital.admin, "POST", "/api/home-health/visits", {
    patient_id: patient.id,
    scheduled_date: today,
    purpose: "Wound dressing",
  });

  const page = await hospital.asAdmin();
  await page.goto("/home-visits");
  const row = page.getByRole("row", { name: new RegExp(patient.first_name) });
  await row.getByRole("button", { name: "Case sheet" }).click();
  const sheet = page.getByRole("dialog", { name: "Home visit case sheet" });
  await expect(page).toHaveURL(/case_sheet=/);
  await sheet.getByRole("button", { name: "New note" }).click();
  await expect(page.getByRole("menuitem", { name: "Consultation", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Nursing note" }).click();
  await sheet.getByRole("textbox", { name: "Observation", exact: true }).click();
  await page.keyboard.type("Wound clean, dressing changed");
  await expect(sheet.getByText(/^Draft saved/)).toBeVisible({ timeout: 10_000 });
  await sheet.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(sheet.getByText(/Signed \w+ \d/).first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/home-healthcare");
  await page.getByLabel("Patient").fill(patient.uhid);
  await page.getByRole("option", { name: new RegExp(patient.uhid) }).first().click();
  await expect(page.getByText("Wound clean, dressing changed")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Home visit ·/)).toBeVisible();
});
