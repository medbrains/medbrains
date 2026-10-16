/**
 * The hospital's admin sets up departments, a ward, its beds and staff from
 * the onboarding workbook: downloads it, fills it, uploads it. A mistake is
 * shown by sheet, row and column with nothing changed; the corrected file is
 * checked, then applied, and the new ward's beds are there.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import writeXlsxFile from "write-excel-file/node";
import { expect, test } from "./support/world";

type Cells = (string | null)[][];

async function writeBook(path: string, t: string, role: string) {
  const sheet = (title: string, rows: Cells) => ({
    sheet: title,
    data: rows.map((r) => r.map((value) => ({ value }))),
  });
  await writeXlsxFile([
      sheet("Departments", [["Code", "Name", "Type"], [`ORT${t}`, "Orthopaedics", "clinical"]]),
      sheet("Wards", [
        ["Code", "Name", "Ward type", "Admits", "Department code"],
        [`OW${t}`, `Ortho Ward ${t}`, "general", "any", `ORT${t}`],
      ]),
      sheet("Beds", [
        ["Bed code", "Ward code", "Room"],
        [`OB${t}1`, `OW${t}`, `OR${t}`],
        [`OB${t}2`, `OW${t}`, `OR${t}`],
      ]),
      sheet("Staff", [
        ["Username", "Full name", "Email", "Role", "Departments"],
        [`ortho_${t.toLowerCase()}`, "Dr Arjun Rao", `arjun.${t.toLowerCase()}@example.test`, role, `ORT${t}`],
      ]),
  ]).toFile(path);
}

test("an admin sets the hospital up from the onboarding workbook", async ({ hospital }) => {
  const t = `${Date.now().toString(36)}`.toUpperCase().slice(-6);
  const dir = mkdtempSync(join(tmpdir(), "workbook-"));
  const page = await hospital.asAdmin();
  await page.goto("/admin/workbook");
  await expect(page.getByRole("heading", { name: "Onboarding workbook" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Blank workbook" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/onboarding-workbook-blank\.xlsx$/);

  const wrong = join(dir, "wrong.xlsx");
  await writeBook(wrong, t, "surgeon");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose workbook (.xlsx)" }).click();
  await (await chooser).setFiles(wrong);
  const result = page.getByTestId("workbook-result");
  await expect(result.getByText("1 problem(s) to fix")).toBeVisible();
  const problem = result.getByRole("table", { name: "Problems" }).getByRole("row").nth(1);
  await expect(problem).toContainText("Staff");
  await expect(problem).toContainText("2");
  await expect(problem).toContainText("Role");
  await expect(result.getByRole("button", { name: "Apply workbook" })).toHaveCount(0);

  const right = join(dir, "right.xlsx");
  await writeBook(right, t, "doctor");
  const again = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose workbook (.xlsx)" }).click();
  await (await again).setFiles(right);
  await expect(result.getByText("Checked — ready to apply")).toBeVisible();
  const beds = result.getByRole("table", { name: "Changes by sheet" }).getByRole("row", { name: /Beds/ });
  await expect(beds).toContainText("2");
  await result.getByRole("button", { name: "Apply workbook" }).click();
  await expect(result.getByText("Applied")).toBeVisible();
  await expect(result.getByText("1 new staff have been emailed how to set their password.")).toBeVisible();

  const [filled] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "With current data" }).click(),
  ]);
  expect(filled.suggestedFilename()).toMatch(/onboarding-workbook\.xlsx$/);
});
