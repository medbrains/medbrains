/**
 * An ER visit has the same case sheet: the emergency doctor writes and signs
 * their note on the visit; an admission's discharge note is not offered here
 * (RFCs/RFC-MODULE-clinical-notes.md, phase 2b).
 */
import { api } from "../helpers/api";
import { createEmergencyVisit, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("the emergency doctor signs their note on the ER visit's case sheet", async ({
  hospital,
}) => {
  const patient = await createPatientApi(hospital.admin);
  // The desk registers the visit; the ER doctor belongs to Emergency Medicine.
  const visit = await createEmergencyVisit(hospital.admin, patient.id, {
    chiefComplaint: "Chest pain for one hour",
  });
  const departments = await api<Array<{ id: string; code: string; name: string }>>(
    hospital.admin,
    "GET",
    "/api/setup/departments",
  );
  const emergency = departments.find((d) => d.code === "EMERGENCY");
  if (!emergency) throw new Error("the hospital has no Emergency Medicine department");
  const drA = await hospital.colleague({ id: emergency.id, name: emergency.name });
  const page = drA.page;
  await page.goto(`/emergency/visits/${visit.id}`);
  await page.getByRole("link", { name: "Case sheet", exact: true }).click();
  const sheet = page.locator("#er-case-sheet");
  await sheet.getByRole("button", { name: "New note" }).click();
  const offered = await page.getByRole("menuitem").allInnerTexts();
  expect(offered).toContain("Consultation");
  expect(offered, "a discharge note belongs to an admission").not.toContain("Discharge note");
  await page.getByRole("menuitem", { name: "Consultation", exact: true }).click();
  await sheet.getByRole("textbox", { name: "Subjective", exact: true }).click();
  await page.keyboard.type("Central chest pain, radiating to left arm, sweating");
  await sheet.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(sheet.getByLabel(`Consultation by ${drA.fullName}`)).toContainText(
    /Signed \w+ \d/,
    { timeout: 15_000 },
  );
});
