/**
 * DPDP Act 2023 at the front desk: a receptionist shows the privacy notice in
 * Tamil, the patient agrees to two purposes beyond care, and the patient's
 * page shows what they agreed to. Later the patient withdraws one — a new
 * decision, with the earlier one still on record.
 */
import { api } from "../helpers/api";
import { expect, test } from "./support/world";
import { RegistrationDesk } from "./pages/registration-desk";

test("the desk records the privacy notice and a later withdrawal", async ({ hospital }) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const dept = await hospital.department(`Privacy OPD ${t}`);
  const phone = `96${String(Date.now()).slice(-8)}`;
  const page = await hospital.as("receptionist");
  const desk = new RegistrationDesk(page);
  await desk.open();
  await desk.register({
    firstName: "Meena",
    lastName: `Privacy${t}`,
    phone,
    sex: "Female",
    ageYears: 34,
    department: dept.name,
    privacy: {
      language: "தமிழ்",
      purposes: ["உங்கள் பதிவுகளை உங்கள் ABHA", "மறு வருகை, பரிசோதனைகள்"],
    },
  });

  const found = await api<{ patients: Array<{ id: string }> }>(
    hospital.admin,
    "GET",
    `/api/patients?search=Privacy${t}`,
  );
  const id = found.patients[0]?.id ?? "";
  await page.goto(`/patients/${id}`);
  const card = page.getByTestId("dpdp-consent-card");
  await expect(card).toContainText("Linking your records to your ABHA");
  await expect(card).toContainText("Reminders about follow-up visits");

  // The patient withdraws reminders; the earlier decision stays on record.
  await card.getByRole("button", { name: "Change" }).click();
  const modal = page.getByRole("dialog", { name: "Privacy notice" });
  // It reopens in the language she was last shown it in.
  await modal.getByLabel(/மறு வருகை/).uncheck();
  const record = modal.getByRole("button", { name: "Record consent" });
  await expect(record).toBeDisabled();
  await modal.getByLabel("I have shown this notice to the patient in the language chosen").check();
  await record.click();
  await expect(modal).toBeHidden();
  await expect(card).not.toContainText("Reminders about follow-up visits");
  await expect(card).toContainText("1 earlier decision(s)");
});
