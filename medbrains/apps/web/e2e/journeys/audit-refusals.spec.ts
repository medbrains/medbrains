/**
 * A nurse's browser asks for something the nurse may not see. The server
 * refuses it, and the refusal is on the audit trail, where an administrator
 * finds it by filtering for refused requests.
 */
import { expect, test } from "./support/world";

test("a refused request is on the audit trail for an administrator to find", async ({ hospital }) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const nurse = await hospital.newStaff("nurse", `Nurse Refused ${t}`);
  // The nurse's own session asks for the user list — refused.
  const refused = await nurse.page.request.get("http://127.0.0.1:3000/api/setup/users");
  expect(refused.status()).toBe(403);

  const page = await hospital.asAdmin();
  await page.goto("/audit");
  await page.getByRole("combobox", { name: "Action" }).click();
  await page.getByRole("option", { name: "Refused (403)" }).click();
  const row = page.getByRole("row").filter({ hasText: `Nurse Refused ${t}` }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("denied");
});
