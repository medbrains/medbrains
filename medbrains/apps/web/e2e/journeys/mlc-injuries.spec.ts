/**
 * An injury on a medico-legal case is recorded from the case page — site
 * picked on the body — and listed numbered, with its printed size, the way
 * the injury certificate reads it.
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a doctor records an injury on an MLC by its site on the body", async ({ hospital }) => {
  test.setTimeout(120_000); // the anatomy model is ~33 MB on first open
  const patient = await createPatientApi(hospital.admin);
  const mlc = await api<{ id: string; mlc_number: string }>(
    hospital.admin,
    "POST",
    "/api/emergency/mlc",
    { patient_id: patient.id, case_type: "assault" },
  );

  const page = await hospital.asAdmin();
  await page.goto("/emergency");
  await page.getByRole("tab", { name: /MLC/ }).click();
  await page
    .getByRole("button", { name: `View MLC case ${mlc.mlc_number}: details and documents` })
    .click();

  const injuries = page.getByRole("form", { name: "Record an injury" });
  await injuries.getByRole("button", { name: "Pick injury site on the body" }).click();
  const picker = page.getByRole("dialog", { name: "Pick injury site" });
  await picker.getByLabel("Find a region or structure").fill("Left patella");
  await page.getByRole("option", { name: "Left patella", exact: true }).click();
  await picker.getByRole("button", { name: "Use this site" }).click();
  await injuries.getByRole("textbox", { name: "length (cm)" }).fill("4.5");
  await injuries.getByRole("textbox", { name: "width (cm)" }).fill("0.5");
  await injuries.getByRole("button", { name: "Record injury" }).click();

  const row = page.getByRole("row", { name: /Left patella/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("4.5 × 0.5 cm");
  await expect(row.getByRole("cell").first()).toHaveText("1");
});
