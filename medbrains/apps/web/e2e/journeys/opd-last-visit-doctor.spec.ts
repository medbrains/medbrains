/**
 * A returning patient goes back to the doctor who saw them: the desk starting
 * today's visit sees the last visit and has its doctor and department chosen.
 */
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("the desk sends a returning patient back to the doctor who saw them", async ({
  hospital,
}) => {
  const clinic = await hospital.department("Cardiology");
  const doctor = await hospital.colleague(clinic);
  const patient = await createPatientApi(hospital.admin);
  await createEncounter(hospital.admin, patient.id, {
    departmentId: clinic.id,
    doctorId: doctor.id,
  });

  const desk = await hospital.as("receptionist");
  await desk.goto("/opd/new");
  await desk.getByLabel("Patient").fill(patient.uhid);
  await desk.getByRole("option", { name: new RegExp(patient.uhid) }).first().click();

  const hint = desk.getByTestId("last-visit-hint");
  await expect(hint).toContainText(doctor.fullName);
  await expect(hint).toContainText(clinic.name);
  await expect(desk.getByRole("combobox", { name: "Department" })).toHaveValue(clinic.name);
  await expect(desk.getByRole("textbox", { name: "Doctor" })).toHaveValue(
    new RegExp(doctor.fullName),
  );
});

test("a first visit says so and leaves the doctor to the desk", async ({ hospital }) => {
  const patient = await createPatientApi(hospital.admin);
  const desk = await hospital.as("receptionist");
  await desk.goto("/opd/new");
  await desk.getByLabel("Patient").fill(patient.uhid);
  await desk.getByRole("option", { name: new RegExp(patient.uhid) }).first().click();
  await expect(desk.getByText("First OPD visit.")).toBeVisible();
  await expect(desk.getByRole("textbox", { name: "Doctor" })).toHaveValue("");
});
