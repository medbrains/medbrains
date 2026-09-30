/**
 * A doctor marks a wrong allergy — corrected on the chart, never erased.
 *
 * The allergy stops alerting and stays listed, struck through, with the
 * reason; its "Mark as wrong" action is gone, since a retired allergy is not
 * re-marked (a real one is recorded again).
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("a doctor marks an allergy entered in error, and it stays on the chart", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  await createEncounter(doctorCtx, patient.id, { departmentId: (await getOpdDept(doctorCtx)).id });
  const allergen = `Sulfa ${crypto.randomUUID().slice(0, 6)}`;
  await api(hospital.admin, "POST", `/api/patients/${patient.id}/allergies`, {
    allergy_type: "drug",
    allergen_name: allergen,
  });

  const page = await hospital.as("doctor");
  await page.goto(`/patients/${patient.id}`);
  await page.getByRole("tab", { name: "Allergies" }).click();
  await page.getByRole("button", { name: `Mark allergy as wrong: ${allergen}` }).click();

  const dialog = page.getByRole("dialog", { name: "Mark allergy as wrong" });
  await dialog.getByLabel("Reason").fill("Recorded on the wrong patient");
  await dialog.getByRole("button", { name: "Mark as wrong" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText(allergen)).toBeVisible();
  await expect(page.getByText("Entered in error: Recorded on the wrong patient")).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Mark allergy as wrong: ${allergen}` }),
  ).toHaveCount(0);
});
