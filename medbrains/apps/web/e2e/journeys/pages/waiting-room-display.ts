/** The full-screen waiting-room display for one department (number only). */
import { expect, type Locator, type Page } from "@playwright/test";

export class WaitingRoomDisplay {
  constructor(private readonly page: Page) {}

  async open(departmentId: string): Promise<void> {
    await this.page.goto(`/token-display?module=opd&scope_id=${departmentId}`);
    await expect(this.page.getByText("MedBrains · Live queue")).toBeVisible();
  }

  /** The board's entry for this token, named with its status, e.g. "Token R-012, Called". */
  token(number: string, status: string): Locator {
    return this.page.getByRole("listitem", { name: `Token ${number}, ${status}` });
  }

  /** The board is public: a patient's name must never appear on it. */
  async expectNoName(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toHaveCount(0);
  }
}
