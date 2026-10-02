/**
 * A doctor records an examination finding at a place picked on the body;
 * it is saved with the consultation and still there on the next load.
 */
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("a doctor records a finding at a site picked on the body", async ({ hospital, request }) => {
  test.setTimeout(120_000); // the anatomy model is ~33 MB on first open
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Physical Exam" }).click();

  await page.getByRole("button", { name: "Pick site on the body" }).click();
  const picker = page.getByRole("dialog", { name: "Pick site" });
  await picker.getByLabel("Find a structure").fill("Left patella");
  await page.getByRole("option", { name: "Left patella", exact: true }).click();
  await picker.getByRole("button", { name: "Use this site" }).click();
  await page.getByRole("textbox", { name: "Finding" }).fill("Swelling, warm");
  await page.getByRole("button", { name: "Add finding" }).click();

  const finding = page.getByText("Left patella: Swelling, warm");
  await expect(finding).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Physical Exam" }).click();
  await expect(finding).toBeVisible({ timeout: 10_000 });
});
