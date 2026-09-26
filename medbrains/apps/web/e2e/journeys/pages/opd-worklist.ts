/** The doctor's OPD screen: find a patient in the queue and move them along. */
import { expect, type Locator, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export class OpdWorklist {
  constructor(private readonly page: Page) {}

  async open(department: string): Promise<void> {
    await this.page.goto("/opd");
    await expect(this.page.getByTestId("field-queue-search")).toBeVisible();
    await expectScreenAccessible(this.page, "opd-worklist");
    const filter = this.page.getByTestId("picker-department");
    await filter.click();
    await filter.fill(department);
    await this.page.getByRole("option", { name: department, exact: true }).click();
  }

  /** The patient's row, found as a doctor finds it: by searching, then by UHID. */
  async row(uhid: string): Promise<Locator> {
    await this.page.getByTestId("field-queue-search").fill(uhid);
    const row = this.page.getByTestId(`row-patient-${uhid}`);
    await expect(row).toBeVisible();
    return row;
  }

  async act(uhid: string, action: "call_patient" | "start_consultation" | "complete_visit") {
    const button = (await this.row(uhid)).getByTestId(`btn-${action}`);
    await expectUsable(button, action);
    await button.click();
  }
}
