/**
 * A doctor's Patients directory matches the queue they work from: a patient
 * seen in the doctor's department is listed; one seen only in another
 * department is not.
 */
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { loginAsRoleApi } from "../helpers/api";
import { expect, test } from "./support/world";

test("a doctor finds their department's patients in the directory", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const ownDept = await getOpdDept(doctorCtx);
  const otherDept = await hospital.department("Elsewhere");

  const seenHere = await createPatientApi(hospital.admin);
  await createEncounter(hospital.admin, seenHere.id, { departmentId: ownDept.id });
  const seenElsewhere = await createPatientApi(hospital.admin);
  await createEncounter(hospital.admin, seenElsewhere.id, { departmentId: otherDept.id });

  const page = await hospital.as("doctor");
  await page.goto("/patients");
  const search = page.getByPlaceholder("Search by UHID, name, or phone...");

  await search.fill(seenHere.uhid);
  await expect(page.getByRole("row", { name: new RegExp(seenHere.uhid) })).toBeVisible({
    timeout: 10_000,
  });

  await search.fill(seenElsewhere.uhid);
  await expect(page.getByText("No patients found")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("row", { name: new RegExp(seenElsewhere.uhid) })).toHaveCount(0);
});
