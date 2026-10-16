/**
 * After the sale: a customer brings a strip back with the receipt, and at the
 * end of the shift the counter's day is counted and closed.
 *
 * Returns used to be priced in the browser from the selling rate, ignoring GST
 * and the return window, and said "may already be refunded" whatever the
 * server refused. Days were never closed at all: there was no screen.
 */
import type { Page } from "@playwright/test";
import {
  addByKeyboard,
  keepSheetsOpen,
  newCounter,
  openCounter,
  openDrawer,
  payCashForThree,
  receiveStock,
} from "./support/pos-counter";
import { expect, test } from "./support/world";

function saleNumber(text: string): string {
  return /PH-SALE-[\w-]+/.exec(text)?.[0] ?? "";
}

async function closeDrawer(page: Page, counted: string) {
  await page.getByRole("button", { name: "Close drawer and cash up" }).click();
  const dialog = page.getByRole("dialog", { name: "Close cash drawer" });
  await dialog.getByRole("textbox", { name: "Actual cash counted (₹)" }).fill(counted);
  await dialog.getByRole("button", { name: /Close/ }).last().click();
  await expect(dialog).toBeHidden();
}

test("a customer returns one strip against the receipt and is refunded on a credit note", async ({
  hospital,
}) => {
  const drug = await receiveStock(hospital.admin, {
    generic: "Fexofenadine",
    schedule: "OTC",
    price: 12,
    quantity: 30,
  });
  const counter = await newCounter(hospital.admin);
  const { page } = await hospital.newStaff("pharmacist", "Returns Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page, counter);
  await addByKeyboard(page, drug);
  const done = await payCashForThree(page, drug);
  const number = saleNumber((await done.textContent()) ?? "");
  expect(number).not.toBe("");

  await page.getByRole("textbox", { name: "Return against a receipt" }).fill(number);
  await page.getByRole("button", { name: "Find sale" }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(`Return items · ${number}`) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Returns are open until/)).toBeVisible();

  const qty = dialog.getByRole("textbox", { name: `Quantity of ${drug.name} coming back` });
  await qty.fill("1");
  await expect(dialog.getByText("Refund ₹12.00")).toBeVisible();
  await dialog.getByRole("button", { name: "Take return" }).click();
  await expect(dialog.getByText("Give the reason for the return.")).toBeVisible();
  await dialog.getByRole("textbox", { name: "Reason for the return" }).fill("Bought one too many");
  await dialog.getByRole("button", { name: "Take return" }).click();

  const note = page.getByRole("dialog", { name: /Credit note CN-/ });
  await expect(note.getByText("Refund ₹12.00")).toBeVisible();
  await expect(note.getByText("CASH: ₹12.00")).toBeVisible();
  await expect(note.getByText("Back to stock")).toBeVisible();
  await note.getByRole("button", { name: "Done" }).click();

  // The same sale now lets only two come back.
  await page.getByRole("textbox", { name: "Return against a receipt" }).fill(number);
  await page.getByRole("button", { name: "Find sale" }).click();
  const again = page.getByRole("dialog", { name: new RegExp(`Return items · ${number}`) });
  const line = again.getByRole("row").filter({ hasText: drug.name });
  await expect(line.getByRole("cell", { name: "2", exact: true })).toBeVisible();
});

test("a cashier cashes up, explains a short count, and closes the counter day", async ({
  hospital,
}) => {
  const counter = await newCounter(hospital.admin);
  const drug = await receiveStock(hospital.admin, {
    generic: "Levocetirizine",
    schedule: "OTC",
    price: 12,
    quantity: 30,
  });
  const { page } = await hospital.newStaff("pharmacist", "Closing Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page, counter);
  await addByKeyboard(page, drug);
  await payCashForThree(page, drug);
  // ₹500 float + ₹36 of sales.
  await closeDrawer(page, "536");

  await page.goto("/pharmacy/finance?tab=day-close");
  const row = page.getByRole("row").filter({ hasText: counter });
  await expect(row.getByText("Not closed")).toBeVisible();
  await row.getByRole("button", { name: "Open day" }).click();
  const panel = page.getByRole("dialog", { name: new RegExp(counter) });
  await expect(panel.getByText("₹536.00").first()).toBeVisible();

  const count = (note: string, pieces: string) =>
    panel.getByRole("textbox", { name: `Number of ₹${note}`, exact: true }).fill(pieces);
  await count("500", "1");
  await expect(panel.getByTestId("day-variance")).toHaveText("Short by ₹36.00");
  await panel.getByRole("button", { name: "Close the day" }).click();
  await expect(panel.getByText("Say why the count differs")).toBeVisible();

  await count("20", "1");
  await count("10", "1");
  await count("5", "1");
  await expect(panel.getByTestId("day-variance")).toHaveText("Short by ₹1.00");
  await panel
    .getByRole("textbox", { name: "Why the count differs" })
    .fill("₹1 coin given as change twice");
  await panel.getByRole("button", { name: "Close the day" }).click();
  await expect(panel.getByText(/Closed ·/)).toBeVisible();
  await expect(panel.getByText(/Short by ₹1\.00: ₹1 coin given as change twice/)).toBeVisible();
  // The cashier who closed it cannot reopen it.
  await expect(panel.getByRole("button", { name: "Reopen day" })).toHaveCount(0);

  // A closed day takes no new drawer at that counter.
  await openCounter(page);
  await page.getByTestId("counter-drawer").getByRole("button", { name: "Open drawer" }).click();
  const open = page.getByRole("dialog", { name: "Open cash drawer" });
  await open.getByRole("combobox", { name: "Pharmacy location" }).click();
  await page.getByRole("option", { name: new RegExp(`^${counter}`) }).click();
  await open.getByRole("textbox", { name: "Opening float (₹)" }).fill("500");
  await open.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText(/already closed at this counter/)).toBeVisible();
});
