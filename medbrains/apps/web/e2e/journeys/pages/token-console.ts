/** The desk's token console: pick the place and counter, call the next patient. */
import { expect, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export class TokenConsole {
  constructor(private readonly page: Page) {}

  async open(department: string): Promise<void> {
    await this.page.goto("/token-console");
    await expect(this.page.getByTestId("btn-call-next")).toBeVisible();
    await expectScreenAccessible(this.page, "token-console");
    const place = this.page.getByTestId("picker-department");
    await place.click();
    await place.fill(department);
    await this.page.getByRole("option", { name: department, exact: true }).click();
  }

  /** The counters the desk is offered, as listed in the picker. */
  async counterChoices(): Promise<string[]> {
    await this.page.getByTestId("picker-counter").click();
    const options = this.page.getByRole("option");
    await expect(options.first()).toBeVisible();
    const names = await options.allInnerTexts();
    await this.page.keyboard.press("Escape");
    return names.map((n) => n.trim()).sort();
  }

  async chooseCounter(name: string): Promise<void> {
    await this.page.getByTestId("picker-counter").click();
    await this.page.getByRole("option", { name, exact: true }).click();
  }

  async callNext(): Promise<void> {
    const call = this.page.getByTestId("btn-call-next");
    await expectUsable(call, "Call next");
    await call.click();
  }
}
