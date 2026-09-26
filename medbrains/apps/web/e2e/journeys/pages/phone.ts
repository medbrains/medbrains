/**
 * The message simulator's phone view: what a patient's or staff member's phone
 * would have received (dev and test only; the server refuses it in production).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { expectScreenAccessible } from "../support/a11y";

export type Channel = "SMS" | "WhatsApp" | "Email";

export class Phone {
  constructor(private readonly page: Page) {}

  /** Opens the phone of the patient with this UHID. */
  async openFor(uhid: string): Promise<void> {
    await this.page.goto("/admin/message-simulator");
    await expectScreenAccessible(this.page, "message-simulator");
    const picker = this.page.getByRole("textbox", { name: "Patient" });
    await picker.fill(uhid);
    await this.page.getByRole("option", { name: new RegExp(uhid) }).click();
    await expect(this.page.getByLabel("Simulated phone")).toBeVisible();
  }

  /** The messages of one channel, newest first. */
  async messages(channel: Channel): Promise<Locator> {
    const phone = this.page.getByLabel("Simulated phone");
    await phone.getByRole("tab", { name: new RegExp(`^${channel}`) }).click();
    return phone.getByRole("tabpanel").getByTestId("simulated-message");
  }

  /** Waits for a message of this event type on this channel, and returns it. */
  async received(channel: Channel, eventType: string, text: RegExp): Promise<Locator> {
    const message = (await this.messages(channel)).filter({ hasText: eventType });
    await expect(message).toContainText(text, { timeout: 20_000 });
    return message;
  }
}
