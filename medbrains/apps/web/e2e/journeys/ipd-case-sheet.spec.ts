/**
 * An admission's notes are its case sheet: the doctor writes the round as a
 * progress note, the nurse a nursing note, each signed; a consultation is not
 * offered on a ward and a discharge note is. The legacy progress-notes read
 * (the MRD packet, print, the AI copilot) sees the signed round
 * (RFCs/RFC-MODULE-clinical-notes.md, phase 2a).
 */
import type { Page } from "@playwright/test";
import { api, loginAsRoleApi } from "../helpers/api";
import { admitToIpd, createPatientApi, freshWardBeds } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

async function openNotes(page: Page, admissionId: string) {
  await page.goto(`/ipd/admissions/${admissionId}#notes`);
  await expect(page.getByText("Case sheet", { exact: true })).toBeVisible({ timeout: 15_000 });
}

test("the ward round and the nursing note are signed on the admission's case sheet", async ({
  hospital,
  request,
}) => {
  test.setTimeout(180_000);
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const [bed] = await freshWardBeds(hospital.admin, 1);
  const admissionId = await admitToIpd(hospital.admin, { patientId: patient.id, bedId: bed?.bed_id });
  const drA = await hospital.doctor();

  const doctor = await hospital.as("doctor");
  await openNotes(doctor, admissionId);
  await doctor.getByRole("button", { name: "New note" }).click();
  const offered = await doctor.getByRole("menuitem").allInnerTexts();
  expect(offered).toContain("Progress note");
  expect(offered).toContain("Discharge note");
  expect(offered, "a consultation is an outpatient note").not.toContain("Consultation");
  expect(offered, "nursing notes are the nurses'").not.toContain("Nursing note");
  await doctor.getByRole("menuitem", { name: "Progress note", exact: true }).click();
  await doctor.getByRole("textbox", { name: "Subjective", exact: true }).click();
  await doctor.keyboard.type("Afebrile overnight, tolerating orals");
  await doctor.getByRole("button", { name: "Sign", exact: true }).click();
  const round = doctor.getByLabel(`Progress note by ${drA.fullName}`);
  await expect(round).toContainText(/Signed \w+ \d/, { timeout: 15_000 });

  const nurse = await hospital.as("nurse");
  await openNotes(nurse, admissionId);
  await nurse.getByRole("button", { name: "New note" }).click();
  await expect(nurse.getByRole("menuitem")).toHaveText(["Nursing note"]);
  await nurse.getByRole("menuitem", { name: "Nursing note" }).click();
  await nurse.getByRole("textbox", { name: "Observation", exact: true }).click();
  await nurse.keyboard.type("Pain 2/10, ambulating");
  await nurse.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(nurse.getByLabel(/^Nursing note by/)).toContainText(/Signed \w+ \d/, {
    timeout: 15_000,
  });
  await expect(nurse.getByText("Afebrile overnight, tolerating orals")).toBeVisible();

  // The older readers of ward notes see the signed round, by its author.
  const legacy = await api<Array<{ note_type: string; author_id: string; subjective: string }>>(
    doctorCtx,
    "GET",
    `/api/ipd/admissions/${admissionId}/progress-notes`,
  );
  const roundRow = legacy.find((n) => n.note_type === "doctor_round");
  expect(roundRow?.subjective).toBe("Afebrile overnight, tolerating orals");
  expect(roundRow?.author_id).toBe(drA.id);
  expect(legacy.map((n) => n.note_type)).toContain("nursing_note");
});
