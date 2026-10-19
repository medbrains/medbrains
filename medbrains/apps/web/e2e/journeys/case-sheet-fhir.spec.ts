/**
 * The doctor exports the visit's case sheet as FHIR for another hospital:
 * the file holds each signed note as a Composition, and the draft is not
 * in it (RFC-MODULE-clinical-notes, phase 4).
 */
import { readFile } from "node:fs/promises";
import { api, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

interface Entry {
  resource: { resourceType: string; status: string; section?: Array<{ text: { div: string } }> };
}

test("a visit's case sheet exports as FHIR Compositions", async ({ hospital, request }) => {
  const doctorCtx = await loginAsRoleApi(request, "doctor");
  const patient = await createPatientApi(hospital.admin);
  const encounterId = await createEncounter(doctorCtx, patient.id, {
    departmentId: (await getOpdDept(doctorCtx)).id,
  });
  const write = (text: string) =>
    api<{ id: string }>(doctorCtx, "POST", `/api/encounters/${encounterId}/clinical-notes`, {
      note_type_code: "consultation",
      sections: [{ code: "subjective", text }],
    });
  const signed = await write("Fever for three days");
  await api(doctorCtx, "POST", `/api/clinical-notes/${signed.id}/sign`, {});
  await write("Still drafting this one");

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${encounterId}`);
  await page.getByRole("tab", { name: "Consultation" }).click();
  const sheet = page.getByRole("tabpanel", { name: "Consultation" });
  await expect(sheet.getByText("Fever for three days").first()).toBeVisible({ timeout: 15_000 });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    sheet.getByRole("button", { name: "FHIR" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`case-sheet-${encounterId}.fhir.json`);
  const bundle = JSON.parse(await readFile(await download.path(), "utf8")) as {
    resourceType: string;
    entry: Entry[];
  };
  expect(bundle.resourceType).toBe("Bundle");
  expect(bundle.entry).toHaveLength(1);
  const [composition] = bundle.entry;
  expect(composition?.resource.resourceType).toBe("Composition");
  expect(composition?.resource.status).toBe("final");
  expect(composition?.resource.section?.[0]?.text.div).toContain("Fever for three days");
});
