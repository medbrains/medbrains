/**
 * In-app role testing (#4804): the quality officer opens a test cycle; a
 * nurse test account opens the Test cases panel on the OPD screen, records a
 * failure (which needs a note); the quality officer sees it on the Test
 * cycles screen with the note, then closes the cycle.
 */
import { api } from "../helpers/api";
import { expect, test } from "./support/world";

test("a tester records a failure from the panel and the cycle owner sees it", async ({ hospital }) => {
  test.setTimeout(180_000);
  const admin = hospital.admin;
  const tag = Date.now().toString(36).slice(-5);
  // Starting state: no other cycle open.
  const open = await api<{ id: string } | null>(admin, "GET", "/api/qa/cycle");
  if (open) await api(admin, "PUT", `/api/qa/cycles/${open.id}/close`);

  const owner = await hospital.as("quality_officer");
  await owner.goto("/admin/test-cycles");
  const form = owner.getByRole("form", { name: "Open a test cycle" });
  await form.getByRole("textbox", { name: "New cycle" }).fill(`Round ${tag}`);
  await form.getByRole("button", { name: "Open cycle" }).click();
  await expect(owner.getByText(`Open: Round ${tag}`)).toBeVisible();

  // A test account: a nurse with the per-user grant the accounts script gives.
  const nurse = await hospital.newStaff("nurse", `Tester ${tag}`, ["qa.test_cases.record"]);
  const page = nurse.page;
  await page.goto("/opd");
  await page.getByRole("button", { name: "Test cases" }).click();
  const drawer = page.getByRole("dialog", { name: "Test cases — Nurse" });
  await expect(drawer.getByText(`Cycle: Round ${tag}`)).toBeVisible();
  await drawer.getByRole("textbox", { name: "Your name" }).fill(`Asha ${tag}`);

  const card = drawer.getByLabel("Test case: Open OPD Queue");
  await card.getByText("Fail", { exact: true }).click();
  await expect(card.getByRole("button", { name: "Save result" })).toBeDisabled();
  await card.getByRole("textbox", { name: "What happened" }).fill(`Queue error ${tag}`);
  await card.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText("Result saved")).toBeVisible();
  await drawer.getByText("Failed", { exact: true }).click();
  await expect(drawer.getByLabel("Test case: Open OPD Queue")).toBeVisible();

  await owner.reload();
  const failures = owner.getByRole("table", { name: "Failures and blocks" });
  const row = failures.getByRole("row").filter({ hasText: `Queue error ${tag}` });
  await expect(row).toContainText("Open OPD Queue");
  await expect(row).toContainText(`Asha ${tag}`);
  await expect(owner.getByRole("table", { name: "Progress by role" }).getByRole("row").filter({ hasText: /^Nurse/ })).toContainText("1 of");

  await owner.getByRole("button", { name: "Close cycle" }).click();
  await expect(owner.getByText("Closed. Its results are kept.")).toBeVisible();
});
