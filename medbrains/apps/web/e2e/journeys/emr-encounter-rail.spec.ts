/**
 * The doctor's encounter rail shows the visit's work; desk and reference
 * tabs wait under "More", and journey steps the doctor may not take are not
 * offered at all.
 */
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("the encounter rail leads with the visit and folds the rest under More", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  for (const name of ["Consultation", "Diagnoses", "Prescriptions", "Follow-up"]) {
    await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  }
  const more = page.getByRole("button", { name: /^More \(\d+\)$/ });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toBeHidden();

  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();

  // Opened from a link, a tab under More is shown with More open.
  await page.reload();
  await expect(page.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // No step is offered that the doctor would be refused.
  await expect(page.getByText(/^Permission/)).toHaveCount(0);
});
