/**
 * An allergy recorded in error comes off the chart when it is removed.
 *
 * The database turns every delete into a soft delete. Before this was fixed
 * the screen said "not found" (the delete reported 0 rows) and the allergy
 * stayed listed — a wrong allergy on a chart withholds a drug the patient can
 * safely take. Only administrators hold `patients.delete` today.
 */
import { createPatientApi } from "../helpers/journey-steps";
import { api } from "../helpers/api";
import { expect, test } from "./support/world";

test("an allergy entered in error is removed from the chart", async ({ hospital }) => {
  const patient = await createPatientApi(hospital.admin);
  const allergen = `Sulfa ${crypto.randomUUID().slice(0, 6)} (entered in error)`;
  await api(hospital.admin, "POST", `/api/patients/${patient.id}/allergies`, {
    allergy_type: "drug",
    allergen_name: allergen,
    severity: "moderate",
  });

  const page = await hospital.asAdmin();
  await page.goto(`/patients/${patient.id}`);
  await page.getByRole("tab", { name: "Allergies" }).click();
  await expect(page.getByText(allergen)).toBeVisible();

  await page.getByRole("button", { name: `Delete allergy: ${allergen}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Allergy removed")).toBeVisible();
  await expect(page.getByText(allergen)).toHaveCount(0);
  // Still gone after a fresh load — the list itself leaves it out.
  await page.reload();
  await page.getByRole("tab", { name: "Allergies" }).click();
  await expect(page.getByText(allergen)).toHaveCount(0);
});
