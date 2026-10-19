/**
 * A dentist charts and treats (#230): on the odontogram they pick tooth 36,
 * record caries, plan a root canal on it, and mark it done — the procedure is
 * charged to the visit's bill once.
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("the dentist charts a tooth, plans its treatment and marks it done", async ({ hospital, request }) => {
  test.setTimeout(120_000);
  const t = Date.now().toString(36).slice(-5);
  // The patient is in the dentist's care: their own OPD visit.
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  await api(doctorCtx, "POST", "/api/specialty/dental/exams", {
    patient_id: patient.id,
    encounter_id: encounterId,
    chief_complaint: `Pain lower left ${t}`,
  });

  const page = await hospital.as("doctor");
  await page.goto("/specialty/dental");
  await page.getByRole("row").filter({ hasText: `Pain lower left ${t}` }).click();
  const drawer = page.getByRole("dialog", { name: "Dental exam" });

  await drawer.getByRole("button", { name: "Tooth 36", exact: true }).click();
  const finding = drawer.getByRole("form", { name: "Tooth finding" });
  await finding.getByRole("combobox", { name: "Condition" }).click();
  await page.getByRole("option", { name: "caries" }).click();
  await finding.getByRole("button", { name: "Add finding" }).click();
  await expect(drawer.getByRole("button", { name: "Tooth 36, caries" })).toBeVisible();

  await drawer.getByRole("tab", { name: "Treatment plan" }).click();
  const plan = drawer.getByRole("form", { name: "Plan a procedure" });
  await plan.getByRole("textbox", { name: "Tooth (FDI)" }).fill("36");
  await plan.getByRole("textbox", { name: "Procedure" }).fill("Root canal treatment");
  await plan.getByRole("textbox", { name: "Price" }).fill("4500");
  await plan.getByRole("button", { name: "Add to plan" }).click();
  await drawer.getByRole("button", { name: "Mark Root canal treatment done" }).click();
  await expect(page.getByText("Charged to the visit's bill.")).toBeVisible();
  await expect(drawer.getByRole("row").filter({ hasText: "Root canal treatment" })).toContainText("done");
  await expect(drawer.getByText(/Done and billed ₹4,500\.00/)).toBeVisible();
});
