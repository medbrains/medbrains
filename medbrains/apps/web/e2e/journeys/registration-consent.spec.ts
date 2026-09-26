/**
 * Registration asks how the patient may be contacted, and the patient page
 * shows — and changes — what they agreed to
 * (RFCs/modules/RFC-MODULE-notification-simulator.md, S2a).
 *
 * WhatsApp and email need the patient's own yes (DPDP Act 2023, WhatsApp
 * business policy); withdrawing must be as easy as agreeing.
 */
import { expect, test } from "@playwright/test";
import { routeApiDirect } from "../helpers";
import { api, getAuthContextFromCookies } from "../helpers/api";

test("a patient who agrees to WhatsApp at the desk can withdraw it later", async ({
  page,
  request,
}) => {
  const ctx = await getAuthContextFromCookies(request);
  const suffix = String(Date.now()).slice(-7);
  const lastName = `Consent${suffix}`;
  await routeApiDirect(page);

  // At the desk.
  await page.goto("/patients/register");
  await page.getByLabel("First Name").fill("Lakshmi");
  await page.getByLabel("Last Name").fill(lastName);
  await page.getByLabel(/^Phone \(primary\)/).fill(`97${suffix}1`);
  await page.getByLabel("Gender").first().click();
  await page.getByRole("option", { name: "Female", exact: true }).click();
  await page.getByLabel("Age years").fill("42");
  // Registration sends the patient to OPD, which needs a department.
  await page.getByPlaceholder("Select department").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByText("How may we contact you?")).toBeVisible();
  await page.getByLabel("Hospital updates on WhatsApp").check();
  // Email updates with no email address is refused on this step.
  await page.getByLabel("Hospital updates by email").check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Add an email address to send email updates")).toBeVisible();
  await page.getByLabel("Hospital updates by email").uncheck();

  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: /^register/i }).click();

  // Their record.
  const idOf = async () => {
    const list = await api<{ patients: Array<{ id: string; last_name: string }> }>(
      ctx,
      "GET",
      `/api/patients?search=${lastName}`,
    );
    return list.patients.find((p) => p.last_name === lastName)?.id ?? "";
  };
  await expect.poll(idOf).not.toBe("");
  const patientId = await idOf();
  await page.goto(`/patients/${patientId}`);

  const whatsapp = page.getByRole("switch", { name: "Hospital updates on WhatsApp" });
  await expect(whatsapp).toBeChecked();
  await expect(page.getByText(/^Agreed .* by /)).toBeVisible();

  // The patient changes their mind.
  await page.locator("label", { has: whatsapp }).click();
  await expect(whatsapp).not.toBeChecked();
  await expect(page.getByText(/^Withdrawn /)).toBeVisible();
});
