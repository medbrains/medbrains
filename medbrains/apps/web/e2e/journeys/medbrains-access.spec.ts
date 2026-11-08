/**
 * The hospital decides when MedBrains support may reach its data. The IT
 * security officer gives a named MedBrains person masked, configuration-only
 * access for two hours, with their password again; what that person does
 * shows up on the screen as they do it; the officer ends it, and the person's
 * next request is refused.
 */
import type { Page } from "@playwright/test";
import { loginAsRole } from "../helpers";
import { api } from "../helpers/api";
import { expect, test } from "./support/world";

/** The status of one API call made from inside the signed-in page. */
function statusOf(page: Page, path: string): Promise<number> {
  return page.evaluate(async (p) => (await fetch(p, { credentials: "include" })).status, path);
}

test("the hospital gives MedBrains masked access, watches it, and ends it", async ({ hospital }) => {
  test.setTimeout(120_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const officer = await hospital.newStaff("it_security_officer", `Security Officer ${t}`);
  // The MedBrains person's account, on a MedBrains address: gated from the
  // moment it exists, and the only kind of account a grant may name.
  const username = `mbsupport_${t.toLowerCase()}`;
  const password = `Support-${t}-Pass1!`;
  const email = `${username}@medbrains.in`;
  await api(hospital.admin, "POST", "/api/setup/users", {
    username,
    email,
    password,
    full_name: `MedBrains Support ${t}`,
    role: "receptionist",
  });
  const support = { page: await hospital.asPublic() };
  await loginAsRole(support.page, username, password);
  await support.page.goto("/dashboard");
  expect(await statusOf(support.page, "/api/admin/kernel")).toBe(403);

  const page = officer.page;
  await page.goto("/security/medbrains-access");
  await expect(page.getByRole("heading", { name: "MedBrains access" })).toBeVisible();
  await page.getByRole("button", { name: "Give access" }).click();

  const form = page.getByRole("dialog", { name: "Give MedBrains access" });
  await form.getByRole("textbox", { name: /email/i }).fill(email);
  await form.getByRole("textbox", { name: "Reason" }).fill(`Ticket ${t}: print settings broken`);
  await form.getByRole("combobox", { name: "What they may reach" }).click();
  await page.getByRole("option", { name: "Configuration only" }).click();
  await form.getByRole("textbox", { name: "Hours" }).fill("2");
  await expect(form.getByRole("switch", { name: /mask patient data/i })).toBeChecked();
  await form.getByRole("button", { name: "Give access" }).click();

  const confirm = page.getByRole("dialog", { name: "Confirm it's you" });
  await confirm.getByLabel("Password").fill(officer.password);
  await confirm.getByRole("button", { name: "Confirm" }).click();

  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Open now");
  await expect(row).toContainText("Patient data masked");
  await expect(row).toContainText("Configuration only");

  // The MedBrains person works under the grant: configuration opens, patients do not.
  expect(await statusOf(support.page, "/api/admin/kernel")).toBe(200);
  expect(await statusOf(support.page, "/api/patients")).toBe(403);

  await page.reload();
  await row.getByRole("button", { name: /Actions \(\d+\)/ }).click();
  const actions = page.getByRole("dialog", { name: `What ${email} did` });
  await expect(actions.getByText("GET /api/admin/kernel").first()).toBeVisible();
  await expect(actions.getByText("Masked").first()).toBeVisible();
  await actions.getByRole("button", { name: /close/i }).click();

  await row.getByRole("button", { name: "End access" }).click();
  const end = page.getByRole("dialog", { name: "End MedBrains access" });
  await end.getByRole("textbox", { name: /reason/i }).fill("Fixed");
  await end.getByRole("button", { name: "End access now" }).click();
  await expect(row).toContainText("Ended");

  expect(await statusOf(support.page, "/api/admin/kernel")).toBe(403);
});
