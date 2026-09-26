/** Admin → Queues, as a hospital administrator uses it. */
import { expect, type Locator, type Page } from "@playwright/test";
import { expectScreenAccessible, expectUsable } from "../support/a11y";

export interface Session {
  label: string;
  /** "HH:MM", the hospital's local time. */
  opens: string;
  closes: string;
  prefix?: string;
}

export class QueueAdmin {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/admin/queues");
    await expect(this.page.getByRole("heading", { name: "Queues" })).toBeVisible();
    await expectScreenAccessible(this.page, "admin-queues");
  }

  /** Narrow the list to this queue, as an admin with dozens of queues does. */
  async find(name: string): Promise<void> {
    await this.page.getByTestId("field-table-search").fill(name);
  }

  row(queueId: string): Locator {
    return this.page.getByTestId(`row-queue-${queueId}`);
  }

  /** Replace the queue's hours through the Hours drawer; none = all day. */
  async setHours(queueId: string, sessions: Session[]): Promise<void> {
    const hours = this.row(queueId).getByTestId("btn-queue-hours");
    await expectUsable(hours, "Hours");
    await hours.click();
    const drawer = this.page.getByRole("dialog", { name: /Hours — / });
    await expect(drawer).toBeVisible();
    await expectScreenAccessible(this.page, "queue-hours-drawer");
    for (const remove of await drawer.getByRole("button", { name: /Remove session/ }).all()) {
      await remove.click();
    }
    for (const [i, s] of sessions.entries()) {
      await drawer.getByTestId("btn-add-session").click();
      await drawer.getByTestId(`field-session-label-${i}`).fill(s.label);
      await drawer.getByTestId(`field-session-opens-${i}`).fill(s.opens);
      await drawer.getByTestId(`field-session-closes-${i}`).fill(s.closes);
      if (s.prefix) await drawer.getByTestId(`field-session-prefix-${i}`).fill(s.prefix);
    }
    const save = drawer.getByTestId("btn-save-hours");
    await expectUsable(save, "Save hours");
    await save.click();
    await expect(this.page.getByText("Hours saved")).toBeVisible();
  }

  async expectNotTakingTokens(queueId: string, reason: string | RegExp): Promise<void> {
    await expect(this.page.getByTestId(`queue-closed-reason-${queueId}`)).toContainText(reason);
  }

  async expectTakingTokens(queueId: string): Promise<void> {
    await expect(this.page.getByTestId(`queue-closed-reason-${queueId}`)).toHaveCount(0);
  }

  /** Create counters by name in the Counters drawer and save them. */
  async createCounters(queueId: string, names: string[]): Promise<void> {
    const open = this.row(queueId).getByTestId("btn-queue-counters");
    await expectUsable(open, "Counters");
    await open.click();
    const drawer = this.page.getByRole("dialog", { name: /Counters — / });
    await expect(drawer).toBeVisible();
    await expectScreenAccessible(this.page, "queue-counters-drawer");
    for (const [i, name] of names.entries()) {
      await drawer.getByTestId("field-new-counter").fill(name);
      await drawer.getByTestId("btn-create-counter").click();
      await expect(drawer.getByTestId(`row-counter-${i}`)).toBeVisible();
    }
    const save = drawer.getByTestId("btn-save-counters");
    await expectUsable(save, "Save counters");
    await save.click();
    await expect(this.page.getByText("Counters saved")).toBeVisible();
  }

  /** Set how the queue's board shows and speaks, through the Edit drawer. */
  async setBoardAndVoice(
    queueId: string,
    { initials, languages, repeat }: { initials: boolean; languages: string[]; repeat: string },
  ): Promise<void> {
    await this.row(queueId).getByTestId("btn-queue-edit").click();
    const drawer = this.page.getByRole("dialog", { name: "Edit queue" });
    await expect(drawer).toBeVisible();
    await drawer
      .getByRole("radiogroup", { name: "The waiting-room board shows" })
      .getByText(initials ? "Number and initials" : "Number only")
      .click();
    // The chip's checkbox is visually hidden; a person clicks its label.
    const labels: Record<string, string> = { en: "English", hi: "हिन्दी (Hindi)", ta: "தமிழ் (Tamil)" };
    for (const [code, label] of Object.entries(labels)) {
      const on = await drawer.getByTestId(`chip-voice-${code}`).isChecked();
      if (on !== languages.includes(code)) await drawer.getByText(label, { exact: true }).click();
    }
    await drawer
      .getByRole("radiogroup", { name: "Say each call" })
      .getByText(repeat, { exact: true })
      .click();
    await drawer.getByRole("button", { name: "Save" }).click();
    await expect(this.page.getByText("Queue saved")).toBeVisible();
  }
}
