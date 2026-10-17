/**
 * An integration officer checks what the hospital's FHIR server offers an
 * ABDM health-information user (#225): the Standards screen reads the live
 * CapabilityStatement, and released lab and imaging reports are now on it as
 * DiagnosticReport, alongside Observation.
 */
import { expect, test } from "./support/world";

test("the standards screen shows lab and imaging reports offered as FHIR", async ({ hospital }) => {
  const page = await hospital.asAdmin();
  await page.goto("/admin/settings#standards");
  const card = page.getByText("FHIR R4 EHR Exchange").locator("xpath=ancestor::*[contains(., 'DiagnosticReport')][1]");
  await expect(card).toContainText("DiagnosticReport");
  await expect(card).toContainText("Observation");
});
