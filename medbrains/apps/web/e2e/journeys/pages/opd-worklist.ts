/** The doctor's OPD screen: find a patient in the queue and move them along. */
import { expect, type Locator, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export class OpdWorklist {
  constructor(private readonly page: Page) {}

  async open(department: string): Promise<void> {
    await this.page.goto("/opd");
    await expect(this.page.getByText("Outpatient department queue")).toBeVisible();
    await expectScreenAccessible(this.page, "opd-worklist");
    const filter = this.page.getByPlaceholder("Department", { exact: true });
    await filter.click();
    await filter.fill(department);
    await this.page.getByRole("option", { name: department, exact: true }).click();
  }

  /** The patient's row, found the way a doctor finds it: by searching the name. */
  async row(patientName: string): Promise<Locator> {
    await this.page.getByPlaceholder("Search token, patient, UHID, phone").fill(patientName);
    const row = this.page.getByRole("row", { name: new RegExp(patientName) });
    await expect(row).toBeVisible();
    return row;
  }

  async act(patientName: string, action: "Call patient" | "Start consultation" | "Complete visit") {
    const button = (await this.row(patientName)).getByRole("button", { name: action });
    await expectUsable(button, action);
    await button.click();
  }
}
