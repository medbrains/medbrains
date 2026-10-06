/**
 * A note left unsigned waits on the author's own list until they sign it,
 * and opens straight back onto its case sheet (RFC-MODULE-clinical-notes,
 * phase 3a).
 */
import { loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("an unsigned note waits on the doctor's list until it is signed", async ({
  hospital,
  request,
}) => {
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
  await page.getByRole("textbox", { name: "Subjective", exact: true }).click();
  await page.keyboard.type("Headache for two days");
  await expect(page.getByText(/^Draft saved/)).toBeVisible({ timeout: 10_000 });

  await page.goto("/doctor/signoffs");
  const card = page.getByLabel("My unsigned notes");
  const entry = card.getByRole("link", { name: new RegExp(patient.uhid) });
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await entry.click();

  await expect(page).toHaveURL(new RegExp(`/opd/encounters/${encounterId}`));
  // The note opens on its case sheet, still a draft, ready to sign.
  const note = page.getByLabel(/^Consultation by /);
  await expect(note).toContainText("Draft — not signed", { timeout: 15_000 });
  await note.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(page.getByText(/Signed \w+ \d/).first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/doctor/signoffs");
  await expect(card.getByRole("link", { name: new RegExp(patient.uhid) })).toHaveCount(0, {
    timeout: 10_000,
  });
});
