/**
 * A deleted department gives its code back. Before, the deleted row kept the
 * code and re-creating it answered "already exists" for a department nobody
 * could see.
 */
import { expect, type Page, test } from "./support/world";

async function addDepartment(page: Page, code: string, name: string) {
  await page.getByRole("button", { name: "Add Department" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Department" });
  await dialog.getByRole("textbox", { name: "Code" }).fill(code);
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).toBeHidden();
}

test("an admin re-creates a department under the code of one they deleted", async ({
  hospital,
}) => {
  const code = `RU${Date.now().toString().slice(-6)}`;
  const page = await hospital.asAdmin();
  await page.goto("/admin/settings#departments");

  await addDepartment(page, code, "Reused Wing");
  await page.getByRole("button", { name: `Delete department Reused Wing (${code})` }).click();
  const confirm = page.getByRole("dialog", { name: "Delete Department" });
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row", { name: new RegExp(code) })).toHaveCount(0);

  await addDepartment(page, code, "Reused Wing, reopened");
  await expect(page.getByRole("row", { name: new RegExp(`${code}.*Reused Wing, reopened`) })).toBeVisible();
  await expect(page.getByText("A department with this code already exists")).toHaveCount(0);
});
