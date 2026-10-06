/**
 * A resident's signed note waits on their consultant: the administrator
 * names the consultant, the resident signs, and the consultant countersigns
 * from the sign-off queue (RFC-MODULE-clinical-notes, phase 3b).
 */
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a resident's signed note is countersigned by their consultant", async ({ hospital }) => {
  const dept = await hospital.department("Countersign");
  const resident = await hospital.colleague(dept);
  const consultant = await hospital.colleague(dept);

  const admin = await hospital.asAdmin();
  await admin.goto("/admin/users");
  await admin.getByPlaceholder("Search name, username, email or role").fill(resident.fullName);
  await admin.getByRole("button", { name: "Edit" }).first().click();
  const picker = admin.getByLabel("Notes countersigned by");
  await picker.fill(consultant.fullName);
  await admin.getByRole("option", { name: new RegExp(consultant.fullName) }).click();
  await expect(admin.getByText("Countersigning consultant set")).toBeVisible();

  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(hospital.admin, patient.id, { departmentId: dept.id });
  const page = resident.page;
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByRole("menuitem", { name: "Consultation", exact: true }).click();
  await page.getByRole("textbox", { name: "Subjective", exact: true }).click();
  await page.keyboard.type("Fever for three days");
  await expect(page.getByText(/^Draft saved/)).toBeVisible({ timeout: 10_000 });
  const note = page.getByLabel(/^Consultation by /);
  await note.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(note).toContainText(`Awaiting countersign by ${consultant.fullName}`, {
    timeout: 15_000,
  });
  await expect(note.getByRole("button", { name: "Countersign" })).toHaveCount(0);

  const review = consultant.page;
  await review.goto("/doctor/signoffs");
  const entry = review
    .getByLabel("Notes to countersign")
    .getByRole("link", { name: new RegExp(patient.uhid) });
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await entry.click();
  const reviewed = review.getByLabel(/^Consultation by /);
  await reviewed.getByRole("button", { name: "Countersign" }).click();
  await expect(reviewed).toContainText(`Countersigned by ${consultant.fullName}`, {
    timeout: 15_000,
  });

  await review.goto("/doctor/signoffs");
  await expect(
    review.getByLabel("Notes to countersign").getByRole("link", { name: new RegExp(patient.uhid) }),
  ).toHaveCount(0, { timeout: 10_000 });
});
