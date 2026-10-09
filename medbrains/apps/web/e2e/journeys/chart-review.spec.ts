/**
 * The patient's notes across visits, read as one record: newest care first,
 * the struck note only when asked for, each opening on its case sheet
 * (RFC-MODULE-clinical-notes, phase 4).
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("a doctor reviews the patient's notes across the record", async ({ hospital, request }) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const write = async (text: string) => {
    const note = await api<{ id: string }>(
      doctorCtx,
      "POST",
      `/api/encounters/${encounterId}/clinical-notes`,
      { note_type_code: "consultation", sections: [{ code: "subjective", text }] },
    );
    await api(doctorCtx, "POST", `/api/clinical-notes/${note.id}/sign`, {});
    return note.id;
  };
  await write("Fever for three days");
  const struck = await write("History of the wrong patient");
  await api(doctorCtx, "POST", `/api/clinical-notes/${struck}/entered-in-error`, {
    reason: "Wrong patient",
  });

  const page = await hospital.as("doctor");
  await page.goto(`/patients/${patient.id}#notes`);
  const panel = page.getByRole("tabpanel", { name: "Notes" });
  await expect(panel.getByText("Fever for three days")).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByText("History of the wrong patient")).toHaveCount(0);

  await panel.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Entered in error" }).click();
  await expect(panel.getByText("Entered in error: Wrong patient")).toBeVisible();
  await expect(panel.getByText("Fever for three days")).toHaveCount(0);

  await panel.getByRole("link", { name: "Open case sheet" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/opd/encounters/${encounterId}`));
});
