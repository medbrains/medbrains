/**
 * A doctor needs the record of a patient outside their care, now. The record
 * is not available to them; they break the glass — a reason, a time limit,
 * their password again — and the record opens. The audit officer is told at
 * once.
 */
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a doctor breaks the glass and the audit officer is told", async ({ hospital }) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const patient = await createPatientApi(hospital.admin, { firstName: "Ravi", lastName: `Glass${t}` });
  const officer = await hospital.newStaff("audit_officer", `Audit Officer ${t}`);
  const doctor = await hospital.newStaff("doctor", `Dr Glass ${t}`);

  const page = doctor.page;
  await page.goto(`/patients/${patient.id}`);
  await expect(page.getByText("This patient record isn't available to you")).toBeVisible();
  await page.getByRole("button", { name: "Emergency access" }).click();
  const dialog = page.getByRole("dialog", { name: "Emergency access" });
  const open = dialog.getByRole("button", { name: "Open the record" });
  await expect(open).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Why you need this record now" }).fill(
    "Unconscious in ER, need allergy history",
  );
  await open.click();

  const confirm = page.getByRole("dialog", { name: "Confirm it's you" });
  await confirm.getByLabel("Password").fill(doctor.password);
  await confirm.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(`Glass${t}`).first()).toBeVisible();

  await officer.page.goto("/dashboard");
  await officer.page.getByRole("button", { name: "Notifications" }).click();
  await expect(officer.page.getByText("Emergency access used").first()).toBeVisible();
  await expect(officer.page.getByText(/Dr Glass .* used emergency access/).first()).toBeVisible();
});
