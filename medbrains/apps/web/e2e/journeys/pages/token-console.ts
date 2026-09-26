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

  /** Press one of a token's own actions (hold, back, recall…) on its row. */
  async act(number: string, action: string): Promise<void> {
    const row = this.page.getByTestId(`row-token-${number}`);
    await expect(row).toBeVisible();
    const button = row.getByTestId(`btn-${action}`);
    await expectUsable(button, action);
    await button.click();
  }

  async expectStatus(number: string, label: string): Promise<void> {
    await expect(this.page.getByTestId(`row-token-${number}`)).toContainText(label);
  }

  /** Move a waiting visit to another department; returns the new number. */
  async transfer(number: string, department: string): Promise<string> {
    await this.act(number, "transfer");
    const dialog = this.page.getByRole("dialog", { name: `Move ${number}` });
    await expect(dialog).toBeVisible();
    await expectScreenAccessible(this.page, "transfer-visit");
    await dialog.getByTestId("picker-transfer-department").fill(department);
    await this.page.getByRole("option", { name: department, exact: true }).click();
    const confirm = dialog.getByTestId("btn-confirm-transfer");
    await expectUsable(confirm, "Move patient");
    await confirm.click();
    const told = this.page.getByText(/(?:new number|Same number) (\S+)/);
    await expect(told).toBeVisible();
    return (await told.innerText()).match(/(?:new number|Same number) (\S+)/)?.[1] ?? "";
  }

  /** A camp team member picks the station they are working. */
  async openCampStation(station: string): Promise<void> {
    await this.page.goto("/token-console");
    await expect(this.page.getByTestId("btn-call-next")).toBeVisible();
    await expectScreenAccessible(this.page, "token-console-camp");
    const module = this.page.getByTestId("picker-module");
    if ((await module.inputValue()) !== "Camp stations") {
      await module.click();
      await this.page.getByRole("option", { name: "Camp stations", exact: true }).click();
    }
    await this.page.getByTestId("picker-station").click();
    await this.page.getByRole("option", { name: station, exact: true }).click();
  }
}
