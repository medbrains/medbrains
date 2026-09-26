/** The front desk's registration screen, as a receptionist uses it. */
import { expect, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export interface WalkIn {
  firstName: string;
  lastName: string;
  phone: string;
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
    const next = this.page.getByRole("button", { name: "Next", exact: true });
    await expectUsable(next, "Next");
    await next.click();
  }

  /** Fills every step a real desk fills and presses Register. */
  async register(patient: WalkIn): Promise<void> {
    const page = this.page;
    await page.getByLabel("First Name").fill(patient.firstName);
    await page.getByLabel("Last Name").fill(patient.lastName);
    await page.getByLabel(/^Phone \(primary\)/).fill(patient.phone);
    await page.getByLabel("Gender").first().click();
    await page.getByRole("option", { name: patient.sex, exact: true }).click();
    await page.getByLabel("Age years").fill(String(patient.ageYears));
    await page.getByPlaceholder("Select department").fill(patient.department);
    // Options read "Name (CODE)".
    await page.getByRole("option", { name: new RegExp(`^${patient.department} \\(`) }).click();
    if (patient.consultant) {
      await page.getByPlaceholder("Select concerned consultant").fill(patient.consultant);
      await page.getByRole("option", { name: new RegExp(`^${patient.consultant}`) }).click();
    }
    await this.next();

    await expect(page.getByText("How may we contact you?")).toBeVisible();
    if (patient.whatsappConsent) {
      await page.getByLabel("Hospital updates on WhatsApp").check();
    }
    for (let step = 0; step < 3; step += 1) await this.next();

    const register = page.getByRole("button", { name: /^register/i });
    await expectUsable(register, "Register");
    await register.click();
  }
}
