/**
 * The consultation note and the history taken in the same visit belong
 * together: signing the note keeps the history, and a draft typed and left
 * is still the author's draft when they come back.
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

const HPI = "Dry cough for three weeks, worse at night";

test("signing the consultation note keeps the history taken in the same visit", async ({
  hospital,
  request,
}) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  // The History tab already took the history of present illness.
  await api(doctorCtx, "POST", `/api/opd/encounters/${encounterId}/consultation`, {
    chief_complaint: "Cough",
    hpi: HPI,
  });

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByRole("menuitem", { name: "Consultation", exact: true }).click();
  await page.getByRole("textbox", { name: "Plan", exact: true }).click();
  await page.keyboard.type("Chest X-ray, review in one week");
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(page.getByText(/Signed \w+ \d/).first()).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByPlaceholder("Describe the history of the present illness in detail..."),
  ).toHaveValue(HPI, { timeout: 10_000 });
  const read = await api<{ plan: string }>(
    doctorCtx,
    "GET",
    `/api/opd/encounters/${encounterId}/consultation`,
  );
  expect(read.plan, "screens that read the visit's consultation see the signed plan").toContain(
    "Chest X-ray, review in one week",
  );
});

test("a draft typed and left is still the author's draft", async ({ hospital, request }) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByRole("menuitem", { name: "Consultation", exact: true }).click();
  const subjective = page.getByRole("textbox", { name: "Subjective", exact: true });
  await subjective.click();
  await page.keyboard.type("Fever for two days");
  // Straight to another tab and back, before the pause that would save it.
  await page.getByRole("tab", { name: "Diagnoses" }).click();
  await page.getByRole("tab", { name: "Consultation" }).click();
  await expect(subjective).toContainText("Fever for two days");
  await expect(page.getByText(/^Draft saved/)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await page.getByRole("tab", { name: "Consultation" }).click();
  await expect(page.getByRole("textbox", { name: "Subjective", exact: true })).toContainText(
    "Fever for two days",
    { timeout: 10_000 },
  );
  await expect(page.getByText("Draft — not signed")).toBeVisible();
});
