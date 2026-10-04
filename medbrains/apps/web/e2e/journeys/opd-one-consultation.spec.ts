/**
 * One consultation per visit. The History, ROS and exam tabs write into the
 * note the SOAP tab saves; editing the SOAP note must not start a second
 * note, which the visit would read instead and hide the history.
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

const HPI = "Dry cough for three weeks, worse at night";

test("editing the SOAP note keeps the history taken in the same visit", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  // The visit already has its note, carrying the history of present illness.
  const first = await api<{ id: string }>(
    doctorCtx,
    "POST",
    `/api/opd/encounters/${encounterId}/consultation`,
    { chief_complaint: "Cough", hpi: HPI },
  );

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  await page.getByRole("button", { name: "Edit note" }).click();
  const plan = page.getByRole("textbox", {
    name: "Treatment plan, medications, investigations, follow-up...",
  });
  await plan.click();
  await page.keyboard.type("Chest X-ray, review in one week");
  await page.getByRole("button", { name: "Save Note" }).click();
  await expect(page.getByText("Chest X-ray, review in one week").first()).toBeVisible({
    timeout: 10_000,
  });

  await page.reload();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByPlaceholder("Describe the history of the present illness in detail..."),
  ).toHaveValue(HPI, { timeout: 10_000 });
  const read = await api<{ id: string; chief_complaint: string }>(
    doctorCtx,
    "GET",
    `/api/opd/encounters/${encounterId}/consultation`,
  );
  expect(read.id, "the visit still reads its one note").toBe(first.id);
  expect(read.chief_complaint, "the edit kept what the note already said").toContain("Cough");
});
