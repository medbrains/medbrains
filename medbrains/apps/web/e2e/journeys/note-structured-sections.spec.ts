/**
 * The history and examination a doctor takes are part of their consultation
 * note: entered on their tabs, shown on the case sheet, signed with it, and
 * from then on read as "Recorded by Dr X" — by a nurse too, who reads them
 * but does not write them (RFCs/RFC-MODULE-clinical-notes.md, phase 1b).
 */
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

const HPI_BOX = "Describe the history of the present illness in detail...";

test("history and examination are signed with the doctor's note", async ({ hospital, request }) => {
  test.setTimeout(180_000);
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const drA = await hospital.doctor();

  const doctor = await hospital.as("doctor");
  await doctor.goto(`/opd/encounters/${encounterId}`);
  await doctor.getByRole("tab", { name: "History", exact: true }).click();
  await expect(doctor.getByText(/Not recorded yet — what you enter starts/)).toBeVisible();
  const hpi = doctor.getByPlaceholder(HPI_BOX);
  await hpi.fill("Dry cough for three weeks, worse at night");
  await hpi.blur();
  await expect(doctor.getByText(/In your unsigned consultation note/)).toBeVisible({
    timeout: 15_000,
  });

  await doctor.getByRole("tab", { name: "Physical Exam", exact: true }).click();
  await doctor.getByLabel("Respiratory").fill("Bilateral expiratory wheeze");
  await doctor.getByRole("tab", { name: "Consultation" }).click();
  const draft = doctor.getByLabel(`Consultation by ${drA.fullName}`);
  await expect(draft).toContainText("HPI: Dry cough for three weeks, worse at night", {
    timeout: 15_000,
  });
  await expect(draft).toContainText("Respiratory: Bilateral expiratory wheeze", {
    timeout: 15_000,
  });
  await draft.getByRole("textbox", { name: "Plan", exact: true }).click();
  await doctor.keyboard.type("Salbutamol inhaler, review in a week");
  await draft.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(draft).toContainText(/Signed \w+ \d/, { timeout: 15_000 });

  await doctor.getByRole("tab", { name: "History", exact: true }).click();
  await expect(doctor.getByText(new RegExp(`Recorded by ${drA.fullName}`))).toBeVisible({
    timeout: 15_000,
  });

  const nurse = await hospital.as("nurse");
  await nurse.goto(`/opd/encounters/${encounterId}`);
  await nurse.getByRole("tab", { name: "History", exact: true }).click();
  await expect(nurse.getByText(new RegExp(`Recorded by ${drA.fullName}`))).toBeVisible({
    timeout: 15_000,
  });
  await expect(nurse.getByPlaceholder(HPI_BOX)).toHaveValue(
    "Dry cough for three weeks, worse at night",
  );
  await expect(nurse.getByPlaceholder(HPI_BOX)).toBeDisabled();
});
