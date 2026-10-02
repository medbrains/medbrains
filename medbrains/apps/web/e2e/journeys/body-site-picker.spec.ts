/**
 * A nurse picks a wound site on the 3D body instead of typing it.
 *
 * The structure search is the keyboard path into the same picker a tap uses;
 * the side follows from the structure's own name, and the chosen site fills
 * the field the wound is saved from.
 */
import { expect, test } from "./support/world";

test("a nurse picks the wound site on the body", async ({ hospital }) => {
  test.setTimeout(120_000); // the anatomy model is ~33 MB on first open
  const page = await hospital.asAdmin();
  await page.goto("/nurse");
  const safety = page.getByRole("tab", { name: "Safety", exact: true });
  await safety.click();
  await expect(safety).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Pick body site on the body" }).click();
  const drawer = page.getByRole("dialog", { name: "Pick body site" });
  await drawer.getByLabel("Find a structure").fill("Left femur");
  await page.getByRole("option", { name: "Left femur", exact: true }).click();
  await expect(drawer.getByText("Selected: Left femur")).toBeVisible();
  await expect(drawer.getByRole("radio", { name: "Left" })).toBeChecked();
  await drawer.getByRole("button", { name: "Use this site" }).click();

  await expect(drawer).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Body site" })).toHaveValue("Left femur");
});
