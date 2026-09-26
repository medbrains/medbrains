/** The full-screen waiting-room display for one department (number only). */
import { expect, type Locator, type Page } from "@playwright/test";

export class WaitingRoomDisplay {
  constructor(private readonly page: Page) {}

  async open(departmentId: string): Promise<void> {
    await this.page.goto(`/token-display?module=opd&scope_id=${departmentId}`);
    await expect(this.page.getByText("MedBrains · Live queue")).toBeVisible();
  }

  /** The board's card for this token. */
  token(number: string): Locator {
    return this.page.getByTestId(`token-${number}`);
  }

  async expectStatus(number: string, status: string): Promise<void> {
    await expect(this.token(number)).toHaveAttribute("data-status", status, { timeout: 15_000 });
    await this.expectReadableAcrossTheRoom(number);
  }

  /** A number split over two lines ("R-" / "028") is misread from the benches. */
  async expectReadableAcrossTheRoom(number: string): Promise<void> {
    const text = this.token(number).getByText(number, { exact: true });
    const lines = await text.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set(Array.from(range.getClientRects(), (r) => Math.round(r.top))).size;
    });
    expect(lines, `token ${number} renders on one line`).toBe(1);
  }

  /** The board is public: a patient's name must never appear on it. */
  async expectNoName(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toHaveCount(0);
  }
}
