/**
 * Eye OPD (#231): from the patient's visit the doctor opens Ophthalmology,
 * records vision and refraction, is told what is still missing before the
 * prescription can be signed, signs it, and prints the spectacle
 * prescription — after which the exam is read-only.
 */
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("the doctor records a refraction, signs it and prints the spectacle prescription", async ({
  hospital,
  request,
}) => {
  test.setTimeout(120_000);
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Specialty" }).click();
  await page.getByRole("button", { name: "Open Ophthalmology for this patient" }).click();
  await expect(page).toHaveURL(/\/specialty\/ophthalmology\?patient_id=.*encounter_id=/);

  await page.getByRole("button", { name: "New exam" }).click();
  const exam = page.getByRole("form", { name: "Eye exam" });
  const fill = (label: string, value: string) =>
    exam.getByRole("textbox", { name: label, exact: true }).fill(value);
  await fill("Right eye (OD) — unaided", "6/18");
  await fill("Left eye (OS) — unaided", "6/24");
  await fill("Right eye (OD) — best corrected", "6/6");
  await fill("Left eye (OS) — best corrected", "6/6");
  await fill("Right eye (OD) — sphere", "-1.25");
  await fill("Left eye (OS) — sphere", "-1.5");
  await fill("Right eye (OD) — cylinder", "-0.5");
  await fill("Right eye (OD) — axis", "180");
  await exam.getByRole("combobox", { name: "Lens type" }).click();
  await page.getByRole("option", { name: "Single vision" }).click();
  await exam.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved").first()).toBeVisible();

  // Saved exams open on their own record; signing without the PD is refused.
  await exam.getByRole("button", { name: "Sign prescription" }).click();
  await expect(exam.getByText("Record the pupillary distance before signing")).toBeVisible();
  await fill("Pupillary distance (mm)", "63");
  await exam.getByRole("button", { name: "Sign prescription" }).click();
  await expect(exam.getByText(/^Signed by/)).toBeVisible();
  await expect(exam.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(exam.getByRole("textbox", { name: "Right eye (OD) — sphere", exact: true })).toHaveAttribute(
    "readonly",
  );

  await exam.getByRole("button", { name: "PDF" }).click();
  const [rendered] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/documents/render")),
    page.context().waitForEvent("page"),
    page.getByRole("menuitem", { name: "Generate & open PDF" }).click(),
  ]);
  expect(rendered.status()).toBe(200);

  // Back on the list, the exam reads as signed.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row").filter({ hasText: "6/18 / 6/24" })).toContainText("Signed");
});
