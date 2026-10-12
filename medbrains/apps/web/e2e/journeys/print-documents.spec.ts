/**
 * Every printed document sits on the screen that holds its record, offers
 * only what the reader may print, and prints what the record says.
 *
 * Before this, 105 print documents existed and one screen could reach them;
 * 48 of their handlers read tables no migration creates and failed on every
 * call. A nurse could not print a treatment chart, quality could not print an
 * incident, pharmacy could not print the NDPS register.
 */
import type { Page } from "@playwright/test";
import { api } from "../helpers/api";
import { admitToIpd, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

/**
 * The sheet prints itself and closes on load; headless Chromium's print()
 * returns at once, so the sheet would be gone before anyone read it.
 */
async function keepSheetsOpen(page: Page) {
  await page.context().addInitScript(() => {
    window.print = () => undefined;
    window.close = () => undefined;
  });
}

/** Pick a document from a print menu and return the sheet it opened. */
async function printFrom(page: Page, menuLabel: string | RegExp, documentLabel: string) {
  await keepSheetsOpen(page);
  await page.getByRole("button", { name: menuLabel }).first().click();
  const [sheet] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByRole("menuitem", { name: documentLabel, exact: true }).click(),
  ]);
  await sheet.waitForLoadState();
  return sheet;
}

test("a nurse prints an admission's treatment chart, and is not offered its bill", async ({
  hospital,
}) => {
  const patient = await createPatientApi(hospital.admin);
  const admissionId = await admitToIpd(hospital.admin, { patientId: patient.id });

  const nurse = await hospital.as("nurse");
  await nurse.goto(`/ipd/admissions/${admissionId}`);
  await nurse.getByRole("button", { name: "Print admission documents" }).click();
  // The chart is ward work; the interim bill is billing's, and a nurse who
  // cannot read the invoice must not be handed a button that 403s.
  await expect(nurse.getByRole("menuitem", { name: "Treatment chart", exact: true })).toBeVisible();
  await expect(nurse.getByRole("menuitem", { name: "IPD interim bill" })).toHaveCount(0);
  await nurse.keyboard.press("Escape");

  const sheet = await printFrom(nurse, "Print admission documents", "Treatment chart");
  await expect(sheet.getByRole("heading", { name: "Treatment chart" })).toBeVisible();
  await expect(sheet.getByText(patient.uhid).first()).toBeVisible();
});

test("quality prints an incident from its row and the report carries what was filed", async ({
  hospital,
}) => {
  const title = `Fall near bed ${crypto.randomUUID().slice(0, 6)}`;
  const incident = await api<{ id: string; incident_number: string }>(
    hospital.admin,
    "POST",
    "/api/quality/incidents",
    {
      title,
      incident_type: "fall",
      severity: "minor",
      incident_date: new Date().toISOString().slice(0, 10),
      immediate_action: "Patient helped back to bed, vitals checked",
    },
  );

  const quality = await hospital.as("quality_officer");
  await quality.goto("/quality");
  await quality.getByRole("tab", { name: "Incidents" }).click();
  const sheet = await printFrom(quality, `Print ${incident.incident_number}`, "Incident report");
  await expect(sheet.getByText(incident.incident_number).first()).toBeVisible();
  await expect(sheet.getByText("Patient helped back to bed, vitals checked")).toBeVisible();
});

test("pharmacy prints the NDPS register for a month", async ({ hospital }) => {
  const pharmacist = await hospital.as("pharmacist");
  await pharmacist.goto("/pharmacy");
  await pharmacist.getByRole("tab", { name: "NDPS Register" }).click();
  await keepSheetsOpen(pharmacist);
  await pharmacist.getByRole("button", { name: "NDPS register" }).click();
  const month = new Date().toLocaleString("en-US", { month: "short" });
  await pharmacist.getByRole("dialog").getByRole("button", { name: month, exact: true }).click();
  const [sheet] = await Promise.all([
    pharmacist.context().waitForEvent("page"),
    pharmacist.getByRole("button", { name: "Print", exact: true }).click(),
  ]);
  await sheet.waitForLoadState();
  await expect(sheet.getByRole("heading", { name: "NDPS register" })).toBeVisible();
});
