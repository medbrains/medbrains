/** The front desk's registration screen, as a receptionist uses it. */
import { expect, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export interface WalkIn {
  firstName: string;
  /** Empty for someone with a single name. */
  lastName: string;
  phone: string;
  /** The desk ticks "Has no phone" instead of typing a number. */
  hasNoPhone?: boolean;
  sex: "Male" | "Female";
  ageYears: number;
  department: string;
  /** The consulting doctor, as the desk picks them. */
  consultant?: string;
  whatsappConsent?: boolean;
}

export class RegistrationDesk {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/patients/register");
    await expect(this.page.getByText("Patient registration")).toBeVisible();
    await expectScreenAccessible(this.page, "patient-registration");
  }

  private async next(): Promise<void> {
    const next = this.page.getByTestId("btn-next");
    await expectUsable(next, "Next");
    await next.click();
  }

  /** Fills every step a real desk fills and presses Register. */
  async register(patient: WalkIn): Promise<void> {
    const page = this.page;
    await page.getByTestId("field-first_name").fill(patient.firstName);
    if (patient.lastName) await page.getByTestId("field-last_name").fill(patient.lastName);
    if (patient.hasNoPhone) await page.getByTestId("field-has_no_phone").check();
    else await page.getByTestId("field-phone").fill(patient.phone);
    await page.getByTestId("picker-gender").click();
    await page.getByRole("option", { name: patient.sex, exact: true }).click();
    await page.getByTestId("field-age_years").fill(String(patient.ageYears));
    // Options are data ("Name (CODE)"), not interface copy.
    await page.getByTestId("picker-department").fill(patient.department);
    await page.getByRole("option", { name: new RegExp(`^${patient.department} \\(`) }).click();
    if (patient.consultant) {
      await page.getByTestId("picker-consultant").fill(patient.consultant);
      await page.getByRole("option", { name: new RegExp(`^${patient.consultant}`) }).click();
    }
    await this.next();

    await expect(page.getByTestId("switch-whatsapp_opt_in")).toBeVisible();
    if (patient.whatsappConsent) await page.getByTestId("switch-whatsapp_opt_in").check();
    for (let step = 0; step < 3; step += 1) await this.next();

    // The review is read back to the patient: names, never record ids.
    const review = page.getByText(/Dept .* · consultant/);
    await expect(review).toContainText(patient.department);
    await expect(review).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);

    const register = page.getByTestId("btn-register");
    await expectUsable(register, "Register");
    await register.click();

    // Among thousands of dev patients a new name can still score as a
    // possible duplicate; the desk has checked it is someone else.
    const duplicates = page.getByRole("dialog", { name: "Potential Duplicates Found" });
    if (await duplicates.waitFor({ state: "visible", timeout: 3_000 }).then(() => true, () => false)) {
      await duplicates.getByRole("button", { name: "Create Anyway" }).click();
      await expect(duplicates).toBeHidden();
    }
  }
}
