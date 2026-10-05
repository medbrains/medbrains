/**
 * The case sheet: each clinician writes their own entry, signed with their
 * name and time; a signed note is revised only within the grace period,
 * added to after it, and struck through — never removed — when in error
 * (RFCs/RFC-MODULE-clinical-notes.md, phase 1).
 */
import type { Page } from "@playwright/test";
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

async function newNote(page: Page, type: string) {
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByRole("menuitem", { name: type, exact: true }).click();
}

async function write(page: Page, section: string, text: string) {
  await page.getByRole("textbox", { name: section, exact: true }).last().click();
  await page.keyboard.type(text);
  // Signing right after typing is the case under test: Sign saves first.
}


test("a doctor and a nurse write, sign and correct their own notes on one visit", async ({
  hospital,
  request,
}) => {
  test.setTimeout(150_000);
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const drA = await hospital.doctor();

  // The doctor writes and signs the consultation.
  const doctor = await hospital.as("doctor");
  await doctor.goto(`/opd/encounters/${encounterId}`);
  await doctor.getByRole("tab", { name: "Consultation" }).click();
  await newNote(doctor, "Consultation");
  await write(doctor, "Subjective", "Dry cough for three weeks");
  await write(doctor, "Plan", "Chest X-ray");
  await doctor.getByRole("button", { name: "Sign", exact: true }).click();
  const consult = doctor.getByLabel(`Consultation by ${drA.fullName}`);
  await expect(consult).toContainText(/Signed \w+ \d/, { timeout: 15_000 });
  await expect(consult).toContainText(drA.fullName);
  await expect(consult.getByText("Chest X-ray", { exact: true })).toBeVisible();

  // Within the grace period the doctor revises; the note says it was revised.
  await consult.getByRole("button", { name: "Revise" }).click();
  await write(doctor, "Plan", "; salbutamol inhaler");
  await doctor.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(consult).toContainText("revised");

  // The doctor adds to it, then starts a progress note and leaves it unsigned.
  await consult.getByRole("button", { name: "Add addendum" }).click();
  await write(doctor, "Addendum", "Chest X-ray normal");
  await doctor.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(consult.getByText("Chest X-ray normal")).toBeVisible();
  await newNote(doctor, "Progress note");
  await write(doctor, "Subjective", "Feels better");

  // The nurse writes only nursing notes, sees the doctor's draft marked as
  // such, and cannot sign or revise the doctor's notes.
  const nurse = await hospital.as("nurse");
  await nurse.goto(`/opd/encounters/${encounterId}`);
  await nurse.getByRole("tab", { name: "Consultation" }).click();
  await nurse.getByRole("button", { name: "New note" }).click();
  await expect(nurse.getByRole("menuitem")).toHaveText(["Nursing note"]);
  await nurse.getByRole("menuitem", { name: "Nursing note" }).click();
  await write(nurse, "Observation", "Afebrile, SpO2 97%");
  await nurse.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(nurse.getByLabel(/^Nursing note by/)).toContainText(/Signed \w+ \d/, { timeout: 15_000 });
  await expect(nurse.getByText("Afebrile, SpO2 97%")).toBeVisible();
  // The doctor's unsigned progress note is visible to the team, and says so.
  await expect(nurse.getByLabel(/^Progress note by/)).toContainText("Draft — not signed");
  const consultAsNurse = nurse.getByLabel(`Consultation by ${drA.fullName}`);
  await expect(consultAsNurse.getByRole("button", { name: "Revise" })).toHaveCount(0);

  // A mistake is struck through with its reason, not removed.
  await doctor.reload();
  await doctor.getByRole("tab", { name: "Consultation" }).click();
  await consult.getByRole("button", { name: "Entered in error" }).first().click();
  const why = doctor.getByRole("dialog", { name: "Mark entered in error" });
  await why.getByLabel("Why it is in error").fill("Written on the wrong visit");
  await why.getByRole("button", { name: "Mark in error" }).click();
  await expect(consult).toContainText("Entered in error: Written on the wrong visit", {
    timeout: 15_000,
  });
  await expect(consult.getByText("Dry cough for three weeks")).toBeVisible();
});
