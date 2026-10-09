/**
 * The doctor prints the visit's case sheet and the print files itself to
 * the medical record: medical records find it on the packet's notes page
 * (RFC-MODULE-clinical-notes, phase 4).
 */
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("a printed case sheet is filed to the medical record", async ({ hospital, request }) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const note = await api<{ id: string }>(
    doctorCtx,
    "POST",
    `/api/encounters/${encounterId}/clinical-notes`,
    { note_type_code: "consultation", sections: [{ code: "subjective", text: "Fever for three days" }] },
  );
  await api(doctorCtx, "POST", `/api/clinical-notes/${note.id}/sign`, {});
  await api(hospital.admin, "POST", `/api/mrd/case-sheets/from-opd/${encounterId}`, {});

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  const sheet = page.getByRole("tabpanel", { name: "Consultation" });
  await expect(sheet.getByText("Fever for three days").first()).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "PDF" }).click();
  const [rendered] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/documents/render")),
    page.context().waitForEvent("page"),
    page.getByRole("menuitem", { name: "Generate & open PDF" }).click(),
  ]);
  expect(rendered.status()).toBe(200);
  expect(await rendered.json()).toMatchObject({ filed_to_mrd: true });

  // ponytail: an administrator, not the MRD officer — the officer's packet
  // list is scoped to patients they have a care relation with (open policy
  // question: MRD-wide record access).
  const mrd = await hospital.asAdmin();
  await mrd.goto(`/mrd?packet_type=opd&encounter_id=${encounterId}#case-sheets`);
  await mrd.getByRole("button", { name: "View page checklist" }).first().click();
  const notesPage = mrd.getByRole("row", { name: /Clinical notes, datewise/ });
  await expect(notesPage.getByText("printed")).toBeVisible({ timeout: 15_000 });
  await expect(notesPage.getByRole("link", { name: "Open filed print" })).toBeVisible();
});
