/** Admin → Paired devices, as an administrator pairs a waiting-room screen. */
import { expect, type Locator, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export class DevicesAdmin {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/admin/paired-devices");
    await expect(this.page.getByText("Screens waiting to be paired")).toBeVisible();
    await expectScreenAccessible(this.page, "paired-devices");
  }

  /** The waiting row of the screen showing `reference`, with the code it shows typed in. */
  private async rowWithCode(reference: string, code: string) {
    const row = this.page.getByTestId(`row-screen-${reference}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row, "the list never shows the code").not.toContainText(code);
    await expect(row.getByTestId(`btn-approve-screen-${reference}`)).toBeDisabled();
    await row.getByTestId(`input-screen-code-${reference}`).fill(code);
    return row;
  }

  /** Approve the screen showing `reference` and `code` for a department's board. */
  async approveScreen(reference: string, code: string, department: string): Promise<void> {
    const row = await this.rowWithCode(reference, code);
    await row.getByTestId(`picker-screen-department-${reference}`).fill(department);
    await this.page.getByRole("option", { name: department, exact: true }).click();
    await this.approve(row, reference);
  }

  /** Approve the screen showing `reference` and `code` as the customer display of a counter. */
  async approveCounterDisplay(reference: string, code: string, counter: string): Promise<void> {
    const row = await this.rowWithCode(reference, code);
    await row.getByRole("combobox", { name: "Board" }).click();
    await this.page.getByRole("option", { name: "Customer display (counter)" }).click();
    await row.getByTestId(`picker-screen-counter-${reference}`).fill(counter);
    await this.page.getByRole("option", { name: counter, exact: true }).click();
    await this.approve(row, reference);
  }

  /** Press Approve on `row` and see the screen leave the waiting list. */
  private async approve(row: Locator, reference: string): Promise<void> {
    const approve = row.getByTestId(`btn-approve-screen-${reference}`);
    await expectUsable(approve, "Approve");
    await approve.click();
    await expect(this.page.getByText(/Screen paired/)).toBeVisible();
    await expect(row).toHaveCount(0);
  }
}
