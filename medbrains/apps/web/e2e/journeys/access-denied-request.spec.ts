/**
 * A receptionist follows a link to the blood bank, which their role does not
 * include. The guard used to drop them on the dashboard with no word of why.
 * Now the screen says which page refused and which permission it needs, they
 * ask for it from there, an administrator approves it on the review screen,
 * and the page opens. (That the approvers are notified is proven by
 * `iam_access_request_notify_test.rs`.) An address no screen answers says so.
 */
import { expect, freshPerson, test } from "./support/world";

const PAGE = "/blood-bank";
const NEEDED = "blood_bank.donors.list";

test("a refused user sees why, asks for access, and gets in once approved", async ({
  hospital,
}) => {
  const person = freshPerson();
  const name = `${person.firstName} ${person.lastName}`;
  const staff = await hospital.newStaff("receptionist", name);
  const page = staff.page;

  await page.goto(PAGE);
  await expect(page).toHaveURL(/\/forbidden$/);
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
  await expect(page.getByText(PAGE, { exact: true })).toBeVisible();
  await expect(page.getByText(NEEDED, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Request access" }).click();
  const form = page.getByRole("form", { name: "Request access" });
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(form.getByText(/Say what you need to do/)).toBeVisible();
  await form
    .getByRole("textbox", { name: "Why do you need it?" })
    .fill("Covering the blood bank desk this shift");
  await form.getByText("1 day").click();
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request waiting for review")).toBeVisible();

  const admin = await hospital.asAdmin();
  await admin.goto("/admin/access-requests");
  const row = admin.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "Approve" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(row).toBeHidden();

  // The approval bumps the permission version; the next load reads it.
  await page.goto(PAGE);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toHaveCount(0);
});

test("an address no screen answers says so, inside the app", async ({ hospital }) => {
  const page = await hospital.as("receptionist");
  await page.goto("/no-such-module/42");
  await expect(
    page.getByRole("heading", { name: "There is no page at this address" }),
  ).toBeVisible();
  await expect(page.getByText("/no-such-module/42", { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();
  await page.getByRole("button", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
