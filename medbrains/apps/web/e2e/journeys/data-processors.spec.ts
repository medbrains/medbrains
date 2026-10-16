/**
 * The privacy officer keeps the register of who processes patient data. An AI
 * service in the US goes on it with no agreement yet — the register flags
 * both the missing agreement and the transfer abroad; once the agreement is
 * recorded it shows in force.
 */
import { expect, test } from "./support/world";

test("the privacy officer registers a processor and its agreement", async ({ hospital }) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const officer = await hospital.newStaff("audit_officer", `Privacy Officer ${t}`);
  const page = officer.page;
  await page.goto("/audit");
  await page.getByRole("tab", { name: "Data processors" }).click();
  await page.getByRole("button", { name: "Add processor" }).click();

  const form = page.getByRole("form", { name: "Data processor" });
  await form.getByRole("textbox", { name: "Processor" }).fill(`Summary AI ${t}`);
  await form.getByRole("textbox", { name: "What it does for the hospital" }).fill("Discharge summary drafts");
  await form.getByRole("combobox", { name: "Patient data it receives" }).click({ force: true });
  await page.getByRole("option", { name: "Clinical records" }).click();
  await form.getByRole("combobox", { name: "Country it keeps the data in" }).click();
  await page.getByRole("option", { name: "United States" }).click();
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: `Summary AI ${t}` });
  await expect(row).toContainText("No agreement");
  await expect(row).toContainText("US · outside India");

  await row.getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("form", { name: "Data processor" });
  await edit.getByRole("textbox", { name: "Agreement reference" }).fill(`DPA-${t}`);
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();
  await expect(row).toContainText("Agreement in force");
});
