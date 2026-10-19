/**
 * The dialysis unit's day: a seronegative patient is booked onto a machine
 * for the morning shift, a dialyzer is issued at the bedside, the session is
 * recorded against both, and the dialyzer now shows its use counted. The
 * shift board offers only machines kept for the patient's serology.
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a patient is booked on a machine, issued a dialyzer, and the use is counted", async ({ hospital }) => {
  // Two screens and two forms: a longer walk than the default 30 s allows.
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const patient = await createPatientApi(hospital.admin);
  await api(hospital.admin, "POST", "/api/specialty/dialysis/machines", {
    code: `HDJ${t}`,
    name: `Bay ${t}`,
    serology: "none",
  });
  await api(hospital.admin, "POST", "/api/specialty/dialysis/machines", {
    code: `HDB${t}`,
    name: `HBsAg bay ${t}`,
    serology: "hbsag",
  });

  const page = await hospital.asAdmin();
  await page.goto("/specialty/other");
  await page.getByRole("tab", { name: "Dialysis" }).click();
  await page.getByRole("tab", { name: "Shifts" }).click();

  const book = page.getByText("Book a shift").locator("..");
  await expect(page.getByRole("table", { name: "Dialysis shifts" })).toBeVisible();
  const search = book.getByRole("textbox", { name: "Patient" });
  await search.click();
  await search.pressSequentially(patient.uhid);
  await page.getByRole("option", { name: new RegExp(patient.uhid) }).click();
  await book.getByRole("combobox", { name: "Machine" }).click();
  // Seronegative: the HBsAg bay is not offered.
  await expect(page.getByRole("option", { name: new RegExp(`HDB${t}`) })).toHaveCount(0);
  await page.getByRole("option", { name: new RegExp(`HDJ${t}`) }).click();
  await book.getByRole("button", { name: "Book" }).click();
  const board = page.getByRole("table", { name: "Dialysis shifts" });
  await expect(board.getByRole("row").filter({ hasText: `HDJ${t}` })).toContainText(patient.uhid);

  await page.getByRole("tab", { name: "Sessions" }).click();
  await page.getByRole("button", { name: "New Session" }).click();
  const drawer = page.getByRole("dialog", { name: "New Dialysis Session" });
  const drawerSearch = drawer.getByRole("textbox", { name: "Patient" });
  await drawerSearch.click();
  await drawerSearch.pressSequentially(patient.uhid);
  await page.getByRole("option", { name: new RegExp(patient.uhid) }).click();
  await drawer.getByRole("combobox", { name: "Booked shift today" }).click();
  await page.getByRole("option", { name: new RegExp(`HDJ${t}`) }).click();
  await drawer.getByRole("textbox", { name: "Label" }).fill(`DZJ${t}`);
  await drawer.getByRole("button", { name: "Issue dialyzer" }).click();
  await expect(drawer.getByText("This will be use 1 of 6")).toBeVisible();
  await drawer.getByRole("textbox", { name: "Access Type" }).fill("AV fistula");
  await drawer.getByRole("button", { name: "Start Session" }).click();
  await expect(drawer).toBeHidden();

  const dialyzers = await api<Array<{ label: string; uses: number }>>(
    hospital.admin,
    "GET",
    `/api/specialty/dialysis/dialyzers?patient_id=${patient.id}`,
  );
  expect(dialyzers.find((d) => d.label === `DZJ${t}`)?.uses).toBe(1);
});
