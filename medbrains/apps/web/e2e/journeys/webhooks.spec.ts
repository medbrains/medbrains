/**
 * An administrator connects a partner system (#224): creates a webhook for
 * a low-stock event, is shown its signing secret once, sees the delivery
 * log, and switches it off again.
 */
import { expect, test } from "./support/world";

test("the administrator adds a webhook, gets its secret once, and switches it off", async ({ hospital }) => {
  test.setTimeout(90_000);
  const name = `Supplier ${Date.now().toString(36).slice(-5)}`;
  const page = await hospital.asAdmin();
  await page.goto("/admin/webhooks");
  await page.getByRole("button", { name: "New webhook" }).click();
  const form = page.getByRole("form", { name: "Webhook" });
  await form.getByRole("textbox", { name: "Partner" }).fill(name);
  await form.getByRole("textbox", { name: "URL" }).fill("http://supplier.example.com/hook");
  await form.getByRole("combobox", { name: "Events" }).click({ force: true });
  await page.getByRole("option", { name: "pharmacy.stock.low" }).click();
  await page.keyboard.press("Escape");
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form.getByText("Must be an https:// address")).toBeVisible();
  await form.getByRole("textbox", { name: "URL" }).fill("https://supplier.example.com/hook");
  await form.getByRole("button", { name: "Create" }).click();

  const secret = page.getByRole("dialog", { name: "Signing secret" });
  await expect(secret.getByLabel("Signing secret")).toContainText("whsec_");
  await secret.getByRole("button", { name: "Done" }).click();

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Active");
  await row.getByRole("button", { name: "Deliveries" }).click();
  await expect(page.getByText("Nothing sent yet")).toBeVisible();
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("form", { name: "Webhook" });
  await edit.getByRole("switch", { name: "Active" }).focus();
  await page.keyboard.press("Space");
  await expect(edit.getByRole("switch", { name: "Active" })).not.toBeChecked();
  await page.getByRole("form", { name: "Webhook" }).getByRole("button", { name: "Save" }).click();
  await expect(row).toContainText("Off");
});
