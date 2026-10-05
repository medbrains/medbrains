/**
 * A diagnosis on the visit says who made it (RFC-MODULE-clinical-notes, 1c).
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("a diagnosis on the visit names the doctor who made it", async ({ hospital, request }) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  await api(doctorCtx, "POST", `/api/opd/encounters/${encounterId}/diagnoses`, {
    description: "Acute bronchitis",
    is_primary: true,
  });
  const drA = await hospital.doctor();

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Diagnoses", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "Diagnoses" });
  await expect(panel.getByText("Acute bronchitis").first()).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByText(new RegExp(`Recorded by ${drA.fullName}`)).first()).toBeVisible();
});
