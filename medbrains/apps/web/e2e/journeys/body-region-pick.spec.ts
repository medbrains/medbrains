/**
 * A clinician names a region — "Left knee" — rather than the bone under it.
 *
 * Regions are offered beside the model's structures; a sided region cannot be
 * used until its side is chosen, and it fills the field in the words a chart
 * reads.
 */
import { expect, test } from "./support/world";

test("a nurse records a wound on the left knee by region", async ({ hospital }) => {
  test.setTimeout(120_000); // the anatomy model is ~33 MB on first open
  const page = await hospital.asAdmin();
  await page.goto("/nurse");
  await page.getByRole("tab", { name: "Safety", exact: true }).click();

  await page.getByRole("button", { name: "Pick body site on the body" }).click();
  const drawer = page.getByRole("dialog", { name: "Pick body site" });
  await expect(drawer.getByRole("radio", { name: "Not stated" })).toBeChecked();
  await drawer.getByLabel("Find a region or structure").fill("Knee");
  await page.getByRole("option", { name: "Knee", exact: true }).click();

  const use = drawer.getByRole("button", { name: "Use this site" });
  await expect(drawer.getByText("Choose the side")).toBeVisible();
  await expect(use).toBeDisabled();
  await drawer.getByText("Left", { exact: true }).click(); // the segment's label
  await expect(drawer.getByRole("radio", { name: "Left" })).toBeChecked();
  await expect(drawer.getByText("Selected: Left knee")).toBeVisible();
  await use.click();

  await expect(drawer).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Body site" })).toHaveValue("Left knee");
});
