/** Admin → Paired devices, as an administrator pairs a waiting-room screen. */
import { expect, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export class DevicesAdmin {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/admin/paired-devices");
    await expect(this.page.getByText("Screens waiting to be paired")).toBeVisible();
    await expectScreenAccessible(this.page, "paired-devices");
  }

  /** Approve the screen showing this code for a department's board. */
  async approveScreen(code: string, department: string): Promise<void> {
    const row = this.page.getByTestId(`row-screen-${code}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByTestId(`picker-screen-department-${code}`).fill(department);
    await this.page.getByRole("option", { name: department, exact: true }).click();
    const approve = row.getByTestId(`btn-approve-screen-${code}`);
    await expectUsable(approve, "Approve");
    await approve.click();
    await expect(this.page.getByText(/Screen paired/)).toBeVisible();
    await expect(row).toHaveCount(0);
  }
}
