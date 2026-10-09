/**
 * A doctor whose access to the consultation is restricted (Admin → field
 * access, `opd.soap_note`) reads a colleague's consultation as withheld, not
 * blank, and is not offered one to write.
 */
import { createConsultation, createEncounter, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a restricted doctor sees the consultation withheld and cannot start one", async ({
  hospital,
}) => {
  const clinic = await hospital.department("General Medicine");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(hospital.admin, patient.id, {
    departmentId: clinic.id,
  });
  await createConsultation(hospital.admin, encounterId, { plan: "Chest X-ray" });

  const { page } = await hospital.colleague(clinic, { "opd.soap_note": "view" });
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  await expect(
    page.getByText("Content withheld: your access to consultation notes is restricted."),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Chest X-ray")).toHaveCount(0);
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page.getByRole("menuitem", { name: "Consultation", exact: true })).toHaveCount(0);
});
