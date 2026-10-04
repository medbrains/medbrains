/**
 * A doctor asks a named colleague in another department for an opinion: the
 * referral names that doctor, and the visit's referral list says so.
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("a doctor refers a patient to a named doctor in another department", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const cardiology = await hospital.department("Cardiology");
  const suffix = Date.now().toString(36);
  const cardiologist = `Asha Menon ${suffix}`;
  await api(hospital.admin, "POST", "/api/setup/users", {
    username: `cardio_${suffix}`,
    email: `cardio_${suffix}@e2e.medbrains.localhost`,
    password: `Cardio-${suffix}-Pass1!`,
    full_name: cardiologist,
    role: "doctor",
    department_ids: [cardiology.id],
    specialization: "Cardiology",
    medical_registration_number: `E2E-C-${suffix}`,
    qualification: "MD",
  });

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Referrals", exact: true }).click();
  await page.getByRole("button", { name: "New Referral" }).click();
  const form = page.getByRole("dialog", { name: "New Referral" });

  await expect(form.getByRole("textbox", { name: "Refer to doctor" })).toBeDisabled();
  await form.getByRole("combobox", { name: "Refer to Department" }).click();
  await page.getByRole("option", { name: cardiology.name, exact: true }).click();
  await form.getByRole("textbox", { name: "Refer to doctor" }).click();
  await page.getByRole("option", { name: new RegExp(cardiologist) }).click();
  await expect(form.getByRole("combobox", { name: "Urgency" })).toHaveValue("Routine");
  await form.getByLabel("Reason for Referral").fill("Exertional chest pain, abnormal ECG");
  await form.getByRole("button", { name: "Create Referral" }).click();

  await expect(form).toBeHidden();
  await expect(page.getByText(`To: Dr. ${cardiologist}`)).toBeVisible({ timeout: 10_000 });
});
