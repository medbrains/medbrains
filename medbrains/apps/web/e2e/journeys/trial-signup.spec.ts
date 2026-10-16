/**
 * A clinic owner finds MedBrains and starts a trial without talking to
 * anyone: says what the facility is and where it should run, sees what that
 * takes, names the hospital, and lands signed in on their own dashboard.
 * Then their staff can find the hospital by its code.
 *
 * Needs the backend started with TRIAL_SIGNUP=open (the trial server).
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("a clinic starts a 30-day trial and signs in by its own code", async ({ page }) => {
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`.toUpperCase();
  await page.goto("/trial");
  await expect(page.getByRole("heading", { name: /Try MedBrains free for 30 days/ })).toBeVisible();

  await page.getByRole("combobox", { name: "What kind of facility?" }).click();
  await page.getByRole("option", { name: "Clinic", exact: true }).click();
  await page.getByRole("textbox", { name: "Beds" }).fill("0");
  await page.getByRole("textbox", { name: "Staff who will sign in" }).fill("8");

  const preview = page.getByTestId("sizing-preview");
  await page.getByText("On your premises").click();
  await expect(preview.getByText("Hardware to buy")).toBeVisible();
  await expect(preview.getByText(/we send the licence and installer/)).toBeVisible();
  await page.getByText("Your own cloud server").click();
  await expect(preview.getByText(/Server cost about ₹[\d,]+ a month/)).toBeVisible();
  await expect(preview.getByText(/Small · 2 vCPU, 4 GB RAM/)).toBeVisible();
  await page.getByText("Our cloud", { exact: true }).click();
  await expect(preview.getByText("Infrastructure is included on our cloud.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  const form = page.getByRole("form", { name: "Your hospital" });
  await form.getByRole("textbox", { name: "Hospital name" }).fill(`Sunrise ${tag} Clinic`);
  // The code is suggested from the name, ready for staff to type.
  await expect(form.getByRole("textbox", { name: "Hospital code" })).toHaveValue(
    `SUNRISE${tag}`.slice(0, 12),
  );
  await form.getByRole("textbox", { name: "Hospital code" }).fill(`SUN${tag}`);
  await form.getByRole("textbox", { name: "Your full name" }).fill("Dr Meena Raj");
  await form.getByRole("textbox", { name: "Work email" }).fill(`meena@sunrise-${tag.toLowerCase()}.example`);
  await form.getByRole("textbox", { name: "Username" }).fill(`meena_${tag.toLowerCase()}`);
  await form.locator("input[type=password]").fill("Sunrise#2026x");
  await form.getByRole("button", { name: "Start my free trial" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });

  // A colleague on another device starts from the code.
  const colleague = await page.context().browser()?.newContext();
  const other = await colleague?.newPage();
  if (!other) throw new Error("no second browser context");
  await other.goto("/login");
  await other.getByRole("textbox", { name: /Hospital code/i }).fill(`SUN${tag}`);
  await other.getByRole("button", { name: /Continue/i }).click();
  await expect(other.getByTestId("login-hospital-name")).toHaveText(`Sunrise ${tag} Clinic`);
  await colleague?.close();
});
