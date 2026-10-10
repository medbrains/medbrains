/**
 * A registration message clears the moment its field is put right — not at
 * the next press of Next, when a receptionist has already been told twice.
 */
import { expect, test } from "./support/world";
test("a fixed field's message clears at once", async ({ hospital }) => {
  const page = await hospital.as("receptionist");
  await page.goto("/patients/register");
  await page.getByTestId("btn-next").click();
  await expect(page.getByText("Choose the patient's sex")).toBeVisible();
  await page.getByTestId("picker-gender").click();
  await page.getByRole("option", { name: "Female", exact: true }).click();
  await expect(page.getByText("Choose the patient's sex")).toBeHidden();
  await page.getByTestId("field-phone").fill("9876543210");
  await page.getByTestId("field-phone").blur();
  await expect(page.getByText("Enter a phone number, or tick Has no phone")).toBeHidden();
});
