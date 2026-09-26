/** The full-screen waiting-room display for one department (number only). */
import { expect, type Locator, type Page } from "@playwright/test";

export class WaitingRoomDisplay {
  constructor(private readonly page: Page) {}

  /**
   * A screen nobody has touched, recording what it says instead of playing
   * it: the test cannot hear, so each utterance's text and language is kept.
   */
  async listen(): Promise<void> {
    await this.page.addInitScript(() => {
      const spoken: { text: string; lang: string }[] = [];
      Object.assign(window, { __spoken: spoken });
      // A TV on a wall that nobody has touched. Playwright's browser reports
      // the page as already activated, which a real untouched screen is not.
      Object.defineProperty(navigator, "userActivation", {
        value: { hasBeenActive: false, isActive: false },
      });
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          speak: (u: SpeechSynthesisUtterance) => spoken.push({ text: u.text, lang: u.lang }),
          cancel: () => undefined,
          getVoices: () => [],
        },
      });
    });
  }

  async spoken(): Promise<{ text: string; lang: string }[]> {
    return this.page.evaluate(
      () => (window as unknown as { __spoken: { text: string; lang: string }[] }).__spoken,
    );
  }

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

  /** Where the patient goes: the counter the token was called to. */
  async expectCounter(number: string, counter: string): Promise<void> {
    await expect(this.token(number)).toContainText(counter, { timeout: 15_000 });
  }

  /** The board is public: a patient's name must never appear on it. */
  async expectNoName(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toHaveCount(0);
  }
}
