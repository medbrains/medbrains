/**
 * An administrator sets up an integration partner (#224): issues a key with
 * its own request budget, sees the budget on the key list, and downloads the
 * API description for the partner's developers.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "./support/world";

test("the administrator issues a rate-limited key and downloads the API description", async ({ hospital }) => {
  test.setTimeout(90_000);
  const name = `lis${Date.now().toString(36).slice(-6)}`;
  const page = await hospital.asAdmin();
  await page.goto("/admin/api-keys");

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "API description (OpenAPI)" }).click(),
  ]);
  expect(file.suggestedFilename()).toBe("medbrains-openapi.json");
  const spec = JSON.parse(readFileSync((await file.path()) ?? "", "utf8"));
  expect(spec.paths["/api/openapi.json"]).toBeTruthy();

  await page.getByRole("button", { name: "Issue key" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("textbox", { name: "Name" }).fill(name);
  await drawer.getByRole("textbox", { name: "Requests a minute" }).fill("30");
  await drawer.getByRole("textbox", { name: "Search permissions" }).fill("Read the API description");
  await drawer.getByRole("button", { name: /^admin/ }).click();
  await drawer.getByRole("checkbox", { name: "Read the API description" }).check();
  await drawer.getByRole("button", { name: /^Issue/ }).click();
  await expect(drawer.getByRole("textbox", { name: "API key secret" })).toBeVisible();
  await drawer.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("30/min");
});
